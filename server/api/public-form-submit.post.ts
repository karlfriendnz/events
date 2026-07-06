import { createClient } from '@supabase/supabase-js'

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
  if (context.type === 'event' && context.id) {
    const { data: ev } = await supabase.from('events')
      .select('id, org_id, title, status, hold_spot_enabled').eq('id', context.id).maybeSingle()
    if (!ev) throw createError({ statusCode: 404, message: 'Event not found' })
    if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') throw createError({ statusCode: 409, message: 'Registrations are closed for this event.' })
    orgId = ev.org_id; contextName = ev.title
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
  const labelToDefId: Record<string, string> = {}
  try {
    const { data: anc } = await supabase.rpc('org_ancestors', { p_org: orgId })
    const chain = [orgId, ...((anc as any[]) ?? []).map((a: any) => a.id)]
    const { data: defs } = await supabase.from('field_definitions').select('id, label, org_id').in('org_id', chain)
    // Own-org definitions win over inherited ones on a label clash.
    for (const d of (defs ?? []).filter((d: any) => d.org_id !== orgId)) labelToDefId[d.label] = d.id
    for (const d of (defs ?? []).filter((d: any) => d.org_id === orgId)) labelToDefId[d.label] = d.id
  } catch { /* field engine optional — fall back to label-keyed custom_fields */ }

  // Core identity labels are stored on dedicated person columns, not custom_fields.
  const CORE_LABELS = new Set(['First Name', 'Last Name', 'Email', 'Email Address', 'Phone', 'Phone Number', 'Date of Birth', 'Gender'])
  const GENDER_MAP: Record<string, string> = { Male: 'MALE', Female: 'FEMALE', 'Non-binary': 'NON_BINARY' }

  // ── Find-or-create a person per person-kind instance, merging field answers ──
  async function upsertPerson(inst: Instance): Promise<string | null> {
    const first = (inst.first_name || '').trim()
    const last = (inst.last_name || '').trim()
    const email = (inst.email || '').trim().toLowerCase()
    if (!first && !last && !email) return null  // nothing to identify a person by

    const raw = inst.fields ?? {}
    const dob = raw['Date of Birth'] || null
    const gender = GENDER_MAP[raw['Gender']] ?? (raw['Gender'] ? 'UNSPECIFIED' : null)
    // Translate field answers → definition-id-keyed custom_fields (skip core fields).
    const customFields: Record<string, any> = {}
    for (const [label, val] of Object.entries(raw)) {
      if (CORE_LABELS.has(label)) continue
      customFields[labelToDefId[label] ?? label] = val
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
  let primaryPersonId: string | null = null
  for (const s of subjects) {
    if ((s.kind ?? 'person') === 'entity') continue
    for (const inst of s.instances) {
      const pid = await upsertPerson(inst)
      if (pid) {
        personIds.push(pid)
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

  const total = Number(totals?.total) || 0
  const fullAnswers = { subjects, payment, termsAccepted, totals }
  let registrationId: string | null = null
  let waitlisted = false

  // ── Context-specific materialisation ──
  if (context.type === 'event') {
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
    discount_total: Number(totals?.discount) || 0,
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
