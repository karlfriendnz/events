import { createClient } from '@supabase/supabase-js'
import { applicableDiscounts, aggregateDiscountLines, discountActive } from '../../composables/useDiscountEval'
import { ageFromDob } from '../../composables/useAge'
// The SAME evaluator the form uses on screen — see useFormConditions' header for why.
import { conditionsPass } from '../../composables/useFormConditions'

/**
 * Generic, context-agnostic registration-form submission endpoint.
 *
 * The SAME registration_forms.config drives many surfaces (event registration,
 * group registration, competition entry, website enquiry…). The public
 * <FormRenderer> posts a normalised payload here; this endpoint:
 *   1. derives the org server-side from the context entity (never trusts the client),
 *   2. runs context-specific materialisation (persons / invitees / registrations /
 *      memberships), and
 *   3. always records one uniform row in form_submissions + a staff notification.
 *
 * Mirrors server/api/public-booking.post.ts: service-role client so an
 * unauthenticated public registrant can write, with org scoping enforced here.
 */

interface Instance {
  first_name?: string; last_name?: string; email?: string; phone?: string
  fields?: Record<string, any>; sessions?: string[]; fee?: number
  // fieldList = the authoritative id-keyed answers (so duplicate labels never merge).
  // `fields` (label-keyed) is kept for a human-readable record + back-compat.
  fieldList?: { id?: string | null; label: string; connected_to?: string | null; account?: string | null; value: any }[]
  fee_option_id?: string | null   // group fee options — the "how do you want to pay" pick
  groups?: { group_id: string; fee_option_id?: string | null }[]  // form-context class picks
}
interface Subject { key: string; label: string; kind: string; instances: Instance[] }

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { formId, context, subjects, payment, termsAccepted, totals, submitter } = body as {
    formId: string | null
    context: { type: string; id?: string | null }
    subjects: Subject[]
    payment?: any; termsAccepted?: any; totals?: any
    submitter?: { name?: string; email?: string; phone?: string } | null
  }

  if (!context?.type) throw createError({ statusCode: 400, message: 'Missing context' })
  if (!Array.isArray(subjects) || !subjects.length) throw createError({ statusCode: 400, message: 'Nothing to submit' })

  // /r/form/:id passes the form as the context entity itself.
  const effectiveFormId: string | null = formId || (context.type === 'form' ? (context.id ?? null) : null)

  const supabase = createClient(supabaseUrl()!, serviceKey()!)

  // ── Resolve org + a human label for the context entity (org derived server-side) ──
  let orgId: string | null = null
  let contextName = ''
  let eventStartAt: string | null = null   // ages a registrant for discount rules (C1)
  let oneDiscountOnly = false               // form.discountSettings.one_discount_only (C1)
  if (context.type === 'event' && context.id) {
    const { data: ev } = await supabase.from('events')
      .select('id, org_id, title, status, hold_spot_enabled, start_at').eq('id', context.id).maybeSingle()
    if (!ev) throw createError({ statusCode: 404, message: 'Event not found' })
    if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') throw createError({ statusCode: 409, message: 'Registrations are closed for this event.' })
    orgId = ev.org_id; contextName = ev.title; eventStartAt = ev.start_at ?? null
  } else if (context.type === 'group' && context.id) {
    const { data: g } = await supabase.from('member_groups').select('id, org_id, name').eq('id', context.id).maybeSingle()
    if (!g) throw createError({ statusCode: 404, message: 'Group not found' })
    orgId = g.org_id; contextName = g.name
  } else if (effectiveFormId) {
    // Generic form context — /r/form/:id (a form connected to 1+ groups) or a
    // bare ?form_id enquiry. The form itself resolves the org.
    const { data: f } = await supabase.from('registration_forms').select('org_id, name').eq('id', effectiveFormId).maybeSingle()
    if (f) { orgId = f.org_id; contextName = f.name }
  }
  if (!orgId) throw createError({ statusCode: 400, message: 'Could not resolve organisation for this submission.' })

  // Resolve the org's field definitions (own + inherited) so per-field answers can
  // be stored on the person keyed by field-definition id — that's how the member
  // profile's Custom fields tab reads them. Answers for fields with no definition
  // (bespoke event-only questions) stay keyed by label.
  // The chain MUST match useOrgFieldPolicy.resolveFields (parent_id chain + every
  // connected sport's chain). If it didn't, a body reachable only by sport would
  // render its field on the form and then have the answer stored by LABEL — which
  // discipline_requirements (keyed by field_definition_id) can never see.
  const labelToDefId: Record<string, string> = {}
  try {
    const [anc, sportAnc] = await Promise.all([
      supabase.rpc('org_ancestors', { p_org: orgId }),
      supabase.rpc('org_sport_ancestors', { p_org: orgId, p_sport: null }),
    ])
    const govIds = [...new Set([
      ...(((anc.data as any[]) ?? []).map((a: any) => a.id)),
      ...(((sportAnc.data as any[]) ?? []).map((a: any) => a.id)),
    ])]
    const chain = [orgId, ...govIds]
    const { data: defs } = await supabase.from('field_definitions').select('id, label, org_id').in('org_id', chain)
    // Own-org definitions win over inherited ones on a label clash.
    for (const d of (defs ?? []).filter((d: any) => d.org_id !== orgId)) labelToDefId[d.label] = d.id
    for (const d of (defs ?? []).filter((d: any) => d.org_id === orgId)) labelToDefId[d.label] = d.id
  } catch { /* field engine optional — fall back to label-keyed custom_fields */ }

  // Core identity labels are stored on dedicated person columns, not custom_fields.
  const CORE_LABELS = new Set(['First Name', 'Last Name', 'Email', 'Email Address', 'Phone', 'Phone Number', 'Date of Birth', 'Gender'])
  const GENDER_MAP: Record<string, string> = { Male: 'MALE', Female: 'FEMALE', 'Non-binary': 'NON_BINARY' }

  // ── Who owns each answer: the PERSON or just this EVENT? ──
  // Every field in the designer carries `connected_to`:
  //   'profile' → the answer belongs to the person (dietary needs, medical) — it
  //               persists onto persons.custom_fields and pre-fills next time.
  //   'event'   → the answer belongs to THIS registration only ("which bus",
  //               "t-shirt size for this camp") and must never touch the profile.
  // Legacy/unset ('none' — the designer's old default) falls back to the previous
  // behaviour, but only for labels that map to a REAL field definition: a known
  // org/NSO field is by definition profile data. A bespoke question nobody defined
  // stays on the registration instead of littering the person with label-keyed junk.
  const fieldConn: Record<string, string> = {}
  // Field-level financial rules ("+$20 when they tick Needs a uniform"), kept for the
  // C1 recompute below. The client applies them to what it SHOWS; the server has to
  // apply them too or the stored total silently drops them.
  const financialFields: any[] = []
  if (effectiveFormId) {
    const { data: fr } = await supabase.from('registration_forms').select('config').eq('id', effectiveFormId).maybeSingle()
    const cfg = (fr?.config ?? {}) as any
    oneDiscountOnly = !!cfg.discountSettings?.one_discount_only
    for (const fields of Object.values(cfg.groupFields ?? {}) as any[]) {
      for (const f of (fields ?? [])) {
        if (f?.label) fieldConn[f.label] = f.connected_to ?? 'none'
        if (f?.has_financial_increase && (f.financial_rules ?? []).length) financialFields.push(f)
      }
    }
    // Legacy flat-shaped forms (config.fieldMeta) carry the same flag.
    for (const f of (cfg.fieldMeta ?? []) as any[]) if (f?.label) fieldConn[f.label] = f.connected_to ?? 'none'
  }
  function goesToProfile(label: string) {
    const conn = fieldConn[label]
    if (conn === 'profile') return true
    if (conn === 'event') return false
    return !!labelToDefId[label]   // unset → only if it's a defined org/NSO field
  }

  // Read a labelled answer off an instance (id-keyed fieldList first, else the
  // label-keyed fields object) — used by the C1 discount recompute (e.g. DOB → age).
  function instVal(inst: Instance, label: string): any {
    if (Array.isArray(inst.fieldList)) { const e = inst.fieldList.find(x => x.label === label); return e ? e.value : undefined }
    return (inst.fields ?? {})[label]
  }

  // ── Find-or-create a person per person-kind instance, merging field answers ──
  async function upsertPerson(inst: Instance): Promise<string | null> {
    const first = (inst.first_name || '').trim()
    const last = (inst.last_name || '').trim()
    const email = (inst.email || '').trim().toLowerCase()
    if (!first && !last && !email) return null  // nothing to identify a person by

    // Prefer the id-keyed fieldList (two fields sharing a label stay distinct);
    // fall back to the label-keyed `fields` object for older/legacy payloads.
    const entries: { id: string | null; label: string; conn: string | null; value: any }[] =
      Array.isArray(inst.fieldList)
        ? inst.fieldList.map(e => ({ id: e.id ?? null, label: e.label, conn: e.connected_to ?? null, value: e.value }))
        : Object.entries(inst.fields ?? {}).map(([label, value]) => ({ id: null, label, conn: null, value }))

    const dob = entries.find(e => e.label === 'Date of Birth')?.value || null
    const gRaw = entries.find(e => e.label === 'Gender')?.value
    const gender = GENDER_MAP[gRaw] ?? (gRaw ? 'UNSPECIFIED' : null)
    // Translate PROFILE-connected answers → custom_fields, keyed by field-definition
    // id when we know it, else the field's own stable id (NOT its label — that's what
    // let duplicate labels overwrite each other). Event-connected answers are dropped
    // here: they live on the registration (form_answers / form_submissions.answers).
    const customFields: Record<string, any> = {}
    for (const e of entries) {
      if (CORE_LABELS.has(e.label)) continue
      const toProfile = e.conn === 'profile' ? true : e.conn === 'event' ? false : goesToProfile(e.label)
      if (!toProfile) continue
      customFields[labelToDefId[e.label] ?? e.id ?? e.label] = e.value
    }

    if (email) {
      const { data: existing } = await supabase.from('persons')
        .select('id, custom_fields').eq('org_id', orgId).ilike('email', email).maybeSingle()
      if (existing?.id) {
        await supabase.from('persons').update({
          first_name: first || undefined, last_name: last || undefined,
          phone: inst.phone || undefined, dob: dob || undefined, gender: gender || undefined,
          custom_fields: { ...(existing.custom_fields ?? {}), ...customFields },
        }).eq('id', existing.id)
        return existing.id
      }
    }
    const { data: created, error: pErr } = await supabase.from('persons').insert({
      org_id: orgId, first_name: first || '—', last_name: last || '—',
      email: email || null, phone: inst.phone || null, dob, gender,
      custom_fields: customFields,
    }).select('id').single()
    if (pErr) throw createError({ statusCode: 500, message: pErr.message })
    return created.id
  }

  // Materialise people for every person subject; remember the primary registrant.
  // Each person keeps their instance's fee-option pick + class picks (form context)
  // so the group enrolment can stamp/route them.
  const personIds: string[] = []
  const feeOptionByPerson: Record<string, string> = {}
  const groupPicksByPerson: Record<string, { group_id: string; fee_option_id?: string | null }[]> = {}
  const instancePid = new Map<Instance, string>()   // instance → its person id (C1 membership status)
  let primaryPersonId: string | null = null
  for (const s of subjects) {
    if ((s.kind ?? 'person') === 'entity') continue
    for (const inst of s.instances) {
      const pid = await upsertPerson(inst)
      if (pid) {
        personIds.push(pid)
        instancePid.set(inst, pid)
        if (inst.fee_option_id) feeOptionByPerson[pid] = inst.fee_option_id
        if (Array.isArray(inst.groups) && inst.groups.length) groupPicksByPerson[pid] = inst.groups
        if (!primaryPersonId) primaryPersonId = pid
      }
    }
  }

  // ── Group enrolment (shared by the group + form contexts) ──────────────────
  // Adds people to a group, or to its waitlist when the class is full. Staff
  // (coach/manager) rows don't count toward capacity.
  const staffish = (row: any) => {
    const keys = [row.role, ...(Array.isArray(row.roles) ? row.roles : [])]
      .filter(Boolean).map((k: string) => String(k).toLowerCase())
    return keys.some(k => k.includes('coach') || k.includes('manager') || k === 'staff')
  }
  async function enrolInGroup(groupId: string, entries: { pid: string; feeOptionId?: string | null }[]): Promise<{ waitlisted: boolean }> {
    const { data: g } = await supabase.from('member_groups')
      .select('id, org_id, term_id, capacity, waitlist_id').eq('id', groupId).maybeSingle()
    if (!g || g.org_id !== orgId || !entries.length) return { waitlisted: false }

    let isFull = false
    if (g.capacity != null) {
      const { data: rows } = await supabase.from('member_group_memberships')
        .select('role, roles').eq('group_id', groupId)
      isFull = (rows ?? []).filter(r => !staffish(r)).length >= g.capacity
    }
    if (isFull && g.waitlist_id) {
      await supabase.from('waitlist_entries').upsert(
        entries.map(e => ({ org_id: orgId, waitlist_id: g.waitlist_id, person_id: e.pid, status: 'waiting' })),
        { onConflict: 'waitlist_id,person_id', ignoreDuplicates: true },
      )
      return { waitlisted: true }
    }

    let term: { start_date: string | null; end_date: string | null } | null = null
    if (g.term_id) {
      const { data: t } = await supabase.from('org_terms').select('start_date, end_date').eq('id', g.term_id).maybeSingle()
      term = t ?? null
    }
    // Only stamp fee options that really belong to this group.
    const { data: validOpts } = await supabase.from('group_fee_options').select('id').eq('group_id', groupId)
    const validOptIds = new Set((validOpts ?? []).map((o: any) => o.id))
    await supabase.from('member_group_memberships').upsert(
      entries.map(e => ({
        group_id: groupId, person_id: e.pid,
        ...(e.feeOptionId && validOptIds.has(e.feeOptionId) ? { fee_option_id: e.feeOptionId } : {}),
        // Stamp the group's term so the enrolment records which term it joined.
        ...(g.term_id ? {
          term_id: g.term_id,
          start_date: term?.start_date ?? null,
          end_date: term?.end_date ?? null,
          membership_status: 'active',
        } : {}),
      })),
      { onConflict: 'group_id,person_id', ignoreDuplicates: true },
    )
    return { waitlisted: false }
  }

  // C1: default to the client's numbers, but for an EVENT we recompute both from
  // authoritative prices + the real discount rules below and never trust the body.
  let total = Number(totals?.total) || 0
  let discountTotal = Number(totals?.discount) || 0
  const fullAnswers = { subjects, payment, termsAccepted, totals }
  let registrationId: string | null = null
  let waitlisted = false

  // ── Context-specific materialisation ──
  if (context.type === 'event') {
    // ── C1: recompute money SERVER-SIDE — never trust the client body totals ──
    // Prices come from the event's own sessions + fee_components; discounts from the
    // discounts table (with their real conditions), evaluated per registrant.
    {
      const { data: sessRows } = await supabase.from('sessions')
        .select('id, is_required, start_at').eq('event_id', context.id)
      const realIds = new Set((sessRows ?? []).map((s: any) => s.id))
      const requiredIds = (sessRows ?? []).filter((s: any) => s.is_required).map((s: any) => s.id)
      const startById: Record<string, string | null> = {}
      for (const s of (sessRows ?? [])) startById[s.id] = s.start_at ?? null

      // Event-level fee lines (session_id null) + per-session components. Only our own
      // session ids feed the .in() — client ids are intersected with realIds, never
      // interpolated into a query (no filter injection from the submitted payload).
      const { data: eventLineRows } = await supabase.from('fee_components')
        .select('amount').eq('event_id', context.id).is('session_id', null)
      const eventLines = (eventLineRows ?? []).map((f: any) => Number(f.amount) || 0)
      const eventBase = eventLines.reduce((a, b) => a + b, 0)
      const feeBySession: Record<string, number> = {}
      if (realIds.size) {
        const { data: sfRows } = await supabase.from('fee_components').select('amount, session_id').in('session_id', [...realIds])
        for (const f of (sfRows ?? [])) if (f.session_id) feeBySession[f.session_id] = (feeBySession[f.session_id] ?? 0) + (Number(f.amount) || 0)
      }

      const dayKeyOf = (iso: string | null) => iso ? new Date(iso).toDateString() : ''
      const weekKeyOf = (iso: string | null) => {
        if (!iso) return ''
        const d = new Date(iso); const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
        t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
        const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
        return t.getUTCFullYear() + '-' + Math.ceil((((t.getTime() - ys.getTime()) / 86400000) + 1) / 7)
      }
      const sessionsByDay: Record<string, string[]> = {}
      const sessionsByWeek: Record<string, string[]> = {}
      for (const s of (sessRows ?? [])) {
        const dk = dayKeyOf(s.start_at); const wk = weekKeyOf(s.start_at)
        if (dk) (sessionsByDay[dk] ??= []).push(s.id)
        if (wk) (sessionsByWeek[wk] ??= []).push(s.id)
      }

      const { data: discRows } = await supabase.from('discounts')
        .select('name, form_text, modifier_type, modifier_value, conditions, apply_to, valid_from, expires_at, is_active')
        .eq('event_id', context.id)
      const activeDiscounts = (discRows ?? []).filter((d: any) => discountActive(d))

      // Membership status per registrant (from persons.membership_type) + the event's
      // current registration count, for the member / first-N discount conditions.
      const statusByPid: Record<string, string> = {}
      if (personIds.length) {
        const { data: mrows } = await supabase.from('persons').select('id, membership_type').in('id', personIds)
        for (const p of (mrows ?? [])) statusByPid[p.id] = p.membership_type ? 'member' : 'non_member'
      }
      const { count: existingRegs } = await supabase.from('registrations')
        .select('id', { count: 'exact', head: true }).eq('event_id', context.id)

      const personInstances: Instance[] = []
      for (const s of subjects) {
        if ((s.kind ?? 'person') === 'entity') continue
        // A field belongs to ONE subject; remember which instance came from where so a
        // Player's fee rule can't be charged against a Parent.
        for (const inst of s.instances) { (inst as any).__subjectKey = s.key; personInstances.push(inst) }
      }
      const refDate = eventStartAt ? new Date(eventStartAt) : new Date()

      let gross = 0
      let regIdx = existingRegs ?? 0
      const perPerson: { name: string; formText: string; amount: number }[][] = []
      for (const inst of personInstances) {
        regIdx++
        const picked = new Set<string>([...(inst.sessions ?? []).filter((id: string) => realIds.has(id)), ...requiredIds])
        const sessionAmounts = [...picked].map(id => feeBySession[id] ?? 0)
        let personTotal = eventBase + sessionAmounts.reduce((a, b) => a + b, 0)
        // Field-level financial rules. A rule only counts when its own field is
        // VISIBLE (a hidden question can't charge you) — the same rule the form applies
        // on screen, so the price shown and the price stored agree.
        const instKey = (inst as any).__subjectKey ?? ''
        const fctx = {
          answer: (label: string) => instVal(inst, label),
          age: ageFromDob(instVal(inst, 'Date of Birth'), refDate),
          memberStatus: instancePid.get(inst) ? (statusByPid[instancePid.get(inst) as string] ?? 'non_member') : '',
          groupIds: Array.isArray((inst as any).groups) ? (inst as any).groups.map((g: any) => g?.group_id ?? g).filter(Boolean) : undefined,
          // personTypes isn't loaded here — a rule that turns on someone's person type
          // can't be verified server-side, so it simply doesn't charge (see below).
        }
        for (const f of financialFields) {
          if ((f.target || '') !== instKey) continue
          if (!conditionsPass(f.visibility_conditions ?? [], fctx)) continue
          for (const rule of (f.financial_rules ?? [])) {
            const amt = Number(rule.amount) || 0
            if (!amt) continue
            if (!conditionsPass(rule.conditions ?? [], fctx)) continue
            personTotal += rule.fee_type === 'discount' ? -amt : amt
          }
        }
        personTotal = Math.max(0, personTotal)
        gross += personTotal
        const positiveAmounts = [...eventLines, ...sessionAmounts].filter(a => a > 0)
        const dates = [...picked].map(id => startById[id]).filter(Boolean) as string[]
        const days = new Set(dates.map(dayKeyOf))
        const fullDay = Object.values(sessionsByDay).some(ids => ids.length > 0 && ids.every(id => picked.has(id)))
        const fullWeek = Object.values(sessionsByWeek).some(ids => ids.length > 0 && ids.every(id => picked.has(id)))
        const pid = instancePid.get(inst)
        perPerson.push(applicableDiscounts(activeDiscounts, {
          personCount: personInstances.length,
          personTotal,
          positiveAmounts,
          selectedSessionCount: picked.size,
          dayCount: days.size,
          fullDay, fullWeek,
          age: ageFromDob(instVal(inst, 'Date of Birth'), refDate),
          selectedSessionDates: dates,
          membershipStatus: pid ? (statusByPid[pid] ?? 'non_member') : 'non_member',
          registrationIndex: regIdx,
        }))
      }
      discountTotal = aggregateDiscountLines(perPerson, oneDiscountOnly).reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
      total = Math.max(0, gross - discountTotal)
    }

    const regStatus = 'CONFIRMED'
    const { data: reg, error: rErr } = await supabase.from('registrations').insert({
      event_id: context.id,
      person_id: primaryPersonId,
      guest_name: submitter?.name || null,
      guest_email: submitter?.email || null,
      status: regStatus,
      total_amount: total,
      form_answers: fullAnswers,
    }).select('id').single()
    if (rErr) throw createError({ statusCode: 500, message: rErr.message })
    registrationId = reg.id

    // Roster — one invitee per person (unique on event_id+person_id, so ignore dupes).
    if (personIds.length) {
      await supabase.from('invitees').upsert(
        personIds.map(pid => ({ event_id: context.id, person_id: pid, status: 'CONFIRMED' })),
        { onConflict: 'event_id,person_id', ignoreDuplicates: true },
      )
    }
    // Selected sessions across every chooser instance.
    const sessionIds = Array.from(new Set(subjects.flatMap(s => s.instances.flatMap(i => i.sessions ?? []))))
    if (sessionIds.length) {
      await supabase.from('registration_sessions').upsert(
        sessionIds.map(sid => ({ registration_id: registrationId, session_id: sid, status: 'CONFIRMED' })),
        { onConflict: 'registration_id,session_id', ignoreDuplicates: true },
      )
    }
  } else if (context.type === 'group' && context.id) {
    // Everyone registered joins THIS group (or its waitlist when full — the
    // public page warns up-front and offers sibling classes with space).
    if (personIds.length) {
      const r = await enrolInGroup(context.id, personIds.map(pid => ({ pid, feeOptionId: feeOptionByPerson[pid] ?? null })))
      waitlisted = r.waitlisted
    }
  } else if (context.type === 'form') {
    // A form connected to groups and/or whole codes (registration_form_targets):
    // each person joins the class(es) they picked in the form's "Choose your
    // class" block. Picks are validated against the connected set server-side —
    // code targets expand to every class in the code's subtree.
    const { data: tgts } = await supabase.from('registration_form_targets')
      .select('target_type, target_id').eq('form_id', effectiveFormId)
    const allowed = new Set((tgts ?? []).filter((t: any) => t.target_type === 'group').map((t: any) => t.target_id))
    const codeTargets = (tgts ?? []).filter((t: any) => t.target_type === 'code').map((t: any) => t.target_id)
    if (codeTargets.length) {
      const { data: codes } = await supabase.from('group_codes').select('id, parent_id').eq('org_id', orgId)
      const children: Record<string, string[]> = {}
      for (const c of (codes ?? [])) if (c.parent_id) (children[c.parent_id] ??= []).push(c.id)
      const expanded = new Set<string>()
      const stack = [...codeTargets]
      while (stack.length) {
        const id = stack.pop()!
        if (expanded.has(id)) continue
        expanded.add(id)
        for (const k of (children[id] ?? [])) stack.push(k)
      }
      const { data: gs } = await supabase.from('member_groups').select('id').in('code_id', [...expanded])
      for (const g of (gs ?? [])) allowed.add(g.id)
    }
    const byGroup: Record<string, { pid: string; feeOptionId?: string | null }[]> = {}
    for (const pid of personIds) {
      for (const pick of (groupPicksByPerson[pid] ?? [])) {
        if (!allowed.has(pick.group_id)) continue
        ;(byGroup[pick.group_id] ??= []).push({ pid, feeOptionId: pick.fee_option_id ?? null })
      }
    }
    let enrolled = 0, queued = 0
    for (const [gid, entries] of Object.entries(byGroup)) {
      const r = await enrolInGroup(gid, entries)
      if (r.waitlisted) queued += entries.length; else enrolled += entries.length
    }
    waitlisted = queued > 0 && enrolled === 0
  }
  // (competition / enquiry / other contexts: the generic submission row below is
  //  the record of truth; richer materialisation can be added per context.)

  // ── Uniform submission record ──
  const { data: sub, error: sErr } = await supabase.from('form_submissions').insert({
    org_id: orgId,
    form_id: effectiveFormId,
    context_type: context.type,
    context_id: context.id || null,
    status: 'SUBMITTED',
    submitter_name: submitter?.name || null,
    submitter_email: submitter?.email || null,
    submitter_phone: submitter?.phone || null,
    answers: fullAnswers,
    total_amount: total,
    discount_total: discountTotal,
    registration_id: registrationId,
  }).select('id').single()
  if (sErr) throw createError({ statusCode: 500, message: sErr.message })

  // ── Staff notification ──
  const who = submitter?.name || submitter?.email || 'Someone'
  const link = context.type === 'event' ? `/events/${context.id}?tab=invitees`
    : context.type === 'group' ? `/groups/${context.id}` : '/registration'
  const { data: notif } = await supabase.from('notifications').insert({
    org_id: orgId,
    type: 'registration.created',
    title: waitlisted
      ? `New waitlist registration${contextName ? ' — ' + contextName : ''}`
      : `New registration${contextName ? ' — ' + contextName : ''}`,
    body: waitlisted
      ? `${who} joined the waitlist (class full)`
      : `${who} registered${total ? ' · ' + (totals?.currency || '') + ' ' + total.toFixed(2) : ''}`,
    link,
    payload: { context_type: context.type, context_id: context.id, submission_id: sub.id, registration_id: registrationId },
  }).select('id').single()
  if (notif?.id) {
    $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: notif.id } }).catch(() => {})
  }

  return { success: true, submissionId: sub.id, registrationId, personCount: personIds.length, waitlisted }
})
