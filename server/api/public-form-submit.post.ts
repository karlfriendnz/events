import { randomUUID } from 'node:crypto'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { orgGoverning } from '../db/repositories/admin'
import { onAttendeeConfirmed } from '../db/repositories/events'
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
 * Reads and writes through the MySQL seam (server/db/client), the same backend the
 * event editor and the public read surface (db/repositories/public.ts) already use.
 * It ran on Supabase until the events themselves moved, at which point every
 * submission 404'd on "Event not found" — the event existed, just not in the
 * database this route was asking. There is no auth to satisfy here: the caller is
 * an anonymous registrant by design, so org scoping is enforced below instead,
 * derived from the context entity and never taken from the body.
 */

/** MySQL DATETIME columns come back as Date; the maths below all expects ISO text. */
function toIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}

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
  // For an event we fall back to the event's OWN form_id below: which subjects pay,
  // and which fields can add money, are the form's business, and a client that
  // omitted formId would otherwise silently skip both — the sort of thing that
  // shows up as a wrong invoice rather than an error.
  let effectiveFormId: string | null = formId || (context.type === 'form' ? (context.id ?? null) : null)

  // ── Resolve org + a human label for the context entity (org derived server-side) ──
  let orgId: string | null = null
  let contextName = ''
  let eventStartAt: string | null = null   // ages a registrant for discount rules (C1)
  let oneDiscountOnly = false               // form.discountSettings.one_discount_only (C1)
  if (context.type === 'event' && context.id) {
    const [ev] = await db.select({
      id: schema.events.id, orgId: schema.events.orgId, title: schema.events.title,
      status: schema.events.status, startAt: schema.events.startAt, formId: schema.events.formId,
    }).from(schema.events).where(eq(schema.events.id, context.id)).limit(1)
    if (!ev) throw createError({ statusCode: 404, message: 'Event not found' })
    if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') throw createError({ statusCode: 409, message: 'Registrations are closed for this event.' })
    orgId = ev.orgId; contextName = ev.title ?? ''; eventStartAt = toIso(ev.startAt)
    effectiveFormId ??= ev.formId ?? null
  } else if (context.type === 'group' && context.id) {
    const [g] = await db.select({ id: schema.memberGroups.id, orgId: schema.memberGroups.orgId, name: schema.memberGroups.name })
      .from(schema.memberGroups).where(eq(schema.memberGroups.id, context.id)).limit(1)
    if (!g) throw createError({ statusCode: 404, message: 'Group not found' })
    orgId = g.orgId; contextName = g.name ?? ''
  } else if (effectiveFormId) {
    // Generic form context — /r/form/:id (a form connected to 1+ groups) or a
    // bare ?form_id enquiry. The form itself resolves the org.
    const [f] = await db.select({ orgId: schema.registrationForms.orgId, name: schema.registrationForms.name })
      .from(schema.registrationForms).where(eq(schema.registrationForms.id, effectiveFormId)).limit(1)
    if (f) { orgId = f.orgId; contextName = f.name ?? '' }
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
    // orgGoverning() IS org_ancestors ∪ org_sport_ancestors — the recursive CTE that
    // replaced both Postgres RPCs when the hierarchy moved to MySQL.
    const govIds = [...new Set((await orgGoverning(orgId)).map(o => o.id))]
    const chain = [orgId, ...govIds]
    const defs = await db.select({ id: schema.fieldDefinitions.id, label: schema.fieldDefinitions.label, orgId: schema.fieldDefinitions.orgId })
      .from(schema.fieldDefinitions).where(inArray(schema.fieldDefinitions.orgId, chain))
    // Own-org definitions win over inherited ones on a label clash.
    for (const d of defs.filter(d => d.orgId !== orgId)) labelToDefId[d.label] = d.id
    for (const d of defs.filter(d => d.orgId === orgId)) labelToDefId[d.label] = d.id
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
  // WHICH SUBJECTS ACTUALLY PAY.
  //
  // A form's people are not all attendees: an Emergency Contact is a person on the
  // form, not a second ticket. The form charges only its "choosers" (FormRenderer's
  // `choosers`: subjects flagged selectsOptions, else the first person subject) —
  // the server charged EVERY person instance, so a $25 event with a required
  // emergency contact invoiced $50 while the screen said $25. Same rule both sides.
  const chooserKeys = new Set<string>()
  if (effectiveFormId) {
    const [fr] = await db.select({ config: schema.registrationForms.config })
      .from(schema.registrationForms).where(eq(schema.registrationForms.id, effectiveFormId)).limit(1)
    const cfg = (fr?.config ?? {}) as any
    oneDiscountOnly = !!cfg.discountSettings?.one_discount_only
    for (const list of Object.values(cfg.groupProfiles ?? {}) as any[][]) {
      const people = (list ?? []).filter((p: any) => p && (p.kind ?? 'person') !== 'entity')
      const flagged = people.filter((p: any) => p.selectsOptions)
      for (const c of (flagged.length ? flagged : people.slice(0, 1))) if (c?.key) chooserKeys.add(c.key)
    }
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
      // Case-insensitive on purpose (Supabase used ilike): people type their address
      // however they like, and a second Person for "Ana@" vs "ana@" is a duplicate
      // profile plus a second invoice.
      const [existing] = await db.select({ id: schema.persons.id, customFields: schema.persons.customFields })
        .from(schema.persons)
        .where(and(eq(schema.persons.orgId, orgId), sql`lower(${schema.persons.email}) = ${email}`))
        .limit(1)
      if (existing?.id) {
        // Only overwrite what they actually supplied — undefined would blank a column.
        const patch: Record<string, any> = {
          customFields: { ...((existing.customFields as Record<string, any>) ?? {}), ...customFields },
        }
        if (first) patch.firstName = first
        if (last) patch.lastName = last
        if (inst.phone) patch.phone = inst.phone
        if (dob) patch.dob = dob
        if (gender) patch.gender = gender
        await db.update(schema.persons).set(patch).where(eq(schema.persons.id, existing.id))
        return existing.id
      }
    }
    const personId = randomUUID()
    await db.insert(schema.persons).values({
      id: personId, orgId, firstName: first || '—', lastName: last || '—',
      email: email || null, phone: inst.phone || null, dob: dob || null, gender: gender || null,
      customFields,
    })
    return personId
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
    const [g] = await db.select({
      id: schema.memberGroups.id, orgId: schema.memberGroups.orgId, termId: schema.memberGroups.termId,
      capacity: schema.memberGroups.capacity, waitlistId: schema.memberGroups.waitlistId,
    }).from(schema.memberGroups).where(eq(schema.memberGroups.id, groupId)).limit(1)
    if (!g || g.orgId !== orgId || !entries.length) return { waitlisted: false }

    let isFull = false
    if (g.capacity != null) {
      const rows = await db.select({ role: schema.memberGroupMemberships.role, roles: schema.memberGroupMemberships.roles })
        .from(schema.memberGroupMemberships).where(eq(schema.memberGroupMemberships.groupId, groupId))
      isFull = rows.filter(r => !staffish(r)).length >= g.capacity
    }
    if (isFull && g.waitlistId) {
      // "Insert the ones that aren't already there" — MySQL has no onConflict, and
      // re-queueing somebody already waiting would move them down their own queue.
      const already = await db.select({ personId: schema.waitlistEntries.personId })
        .from(schema.waitlistEntries).where(eq(schema.waitlistEntries.waitlistId, g.waitlistId))
      const have = new Set(already.map(r => r.personId))
      const fresh = entries.filter(e => !have.has(e.pid))
      if (fresh.length) {
        await db.insert(schema.waitlistEntries).values(fresh.map(e => ({
          // sortOrder/priority are NOT NULL with no default; 0 is the back of the
          // queue in creation order, which is what joining a waitlist means.
          id: randomUUID(), orgId: orgId!, waitlistId: g.waitlistId!, personId: e.pid,
          status: 'waiting', sortOrder: 0, priority: 0,
        })))
      }
      return { waitlisted: true }
    }

    let term: { startDate: string | null; endDate: string | null } | null = null
    if (g.termId) {
      const [t] = await db.select({ startDate: schema.orgTerms.startDate, endDate: schema.orgTerms.endDate })
        .from(schema.orgTerms).where(eq(schema.orgTerms.id, g.termId)).limit(1)
      term = t ?? null
    }
    // Only stamp fee options that really belong to this group.
    const validOpts = await db.select({ id: schema.groupFeeOptions.id })
      .from(schema.groupFeeOptions).where(eq(schema.groupFeeOptions.groupId, groupId))
    const validOptIds = new Set(validOpts.map(o => o.id))
    // Same ignore-duplicates rule: an existing enrolment keeps its own term/fee stamp
    // rather than being silently rewritten by a later public sign-up.
    const existingMembers = await db.select({ personId: schema.memberGroupMemberships.personId })
      .from(schema.memberGroupMemberships).where(eq(schema.memberGroupMemberships.groupId, groupId))
    const enrolled = new Set(existingMembers.map(r => r.personId))
    const toAdd = entries.filter(e => !enrolled.has(e.pid))
    if (toAdd.length) {
      await db.insert(schema.memberGroupMemberships).values(toAdd.map(e => ({
        groupId, personId: e.pid,
        positions: [],   // NOT NULL json with no default

        ...(e.feeOptionId && validOptIds.has(e.feeOptionId) ? { feeOptionId: e.feeOptionId } : {}),
        // Stamp the group's term so the enrolment records which term it joined.
        ...(g.termId ? {
          termId: g.termId,
          startDate: term?.startDate ?? null,
          endDate: term?.endDate ?? null,
          membershipStatus: 'active',
        } : {}),
      })))
    }
    return { waitlisted: false }
  }

  // C1: default to the client's numbers, but for an EVENT we recompute both from
  // authoritative prices + the real discount rules below and never trust the body.
  let total = Number(totals?.total) || 0
  let discountTotal = Number(totals?.discount) || 0
  const fullAnswers = { subjects, payment, termsAccepted, totals }
  let registrationId: string | null = null
  let waitlisted = false
  // Who the club actually invoices. Defaults to everyone (non-event contexts keep
  // their existing behaviour) and is narrowed to the paying subjects below.
  let payingPersonIds: string[] = personIds

  // ── Context-specific materialisation ──
  if (context.type === 'event') {
    // ── C1: recompute money SERVER-SIDE — never trust the client body totals ──
    // Prices come from the event's own sessions + fee_components; discounts from the
    // discounts table (with their real conditions), evaluated per registrant.
    {
      const sessRowsRaw = await db.select({ id: schema.sessions.id, isRequired: schema.sessions.isRequired, startAt: schema.sessions.startAt })
        .from(schema.sessions).where(eq(schema.sessions.eventId, context.id))
      const sessRows = sessRowsRaw.map(s => ({ id: s.id, is_required: !!s.isRequired, start_at: toIso(s.startAt) }))
      const realIds = new Set(sessRows.map(s => s.id))
      const requiredIds = sessRows.filter(s => s.is_required).map(s => s.id)
      const startById: Record<string, string | null> = {}
      for (const s of sessRows) startById[s.id] = s.start_at ?? null

      // Event-level fee lines (session_id null) + per-session components. Only our own
      // session ids feed the .in() — client ids are intersected with realIds, never
      // interpolated into a query (no filter injection from the submitted payload).
      const eventLineRows = await db.select({ amount: schema.feeComponents.amount })
        .from(schema.feeComponents)
        .where(and(eq(schema.feeComponents.eventId, context.id), isNull(schema.feeComponents.sessionId)))
      const eventLines = eventLineRows.map(f => Number(f.amount) || 0)
      const eventBase = eventLines.reduce((a, b) => a + b, 0)
      const feeBySession: Record<string, number> = {}
      if (realIds.size) {
        const sfRows = await db.select({ amount: schema.feeComponents.amount, sessionId: schema.feeComponents.sessionId })
          .from(schema.feeComponents).where(inArray(schema.feeComponents.sessionId, [...realIds]))
        for (const f of sfRows) if (f.sessionId) feeBySession[f.sessionId] = (feeBySession[f.sessionId] ?? 0) + (Number(f.amount) || 0)
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
      for (const s of sessRows) {
        const dk = dayKeyOf(s.start_at); const wk = weekKeyOf(s.start_at)
        if (dk) (sessionsByDay[dk] ??= []).push(s.id)
        if (wk) (sessionsByWeek[wk] ??= []).push(s.id)
      }

      // camelCase straight from Drizzle: useDiscountEval reads BOTH shapes (see its
      // discountActive header), so the rows need no renaming to be evaluated.
      const discRows = await db.select({
        name: schema.discounts.name, formText: schema.discounts.formText,
        modifierType: schema.discounts.modifierType, modifierValue: schema.discounts.modifierValue,
        conditions: schema.discounts.conditions, applyTo: schema.discounts.applyTo,
        validFrom: schema.discounts.validFrom, expiresAt: schema.discounts.expiresAt,
        isActive: schema.discounts.isActive,
      }).from(schema.discounts).where(eq(schema.discounts.eventId, context.id))
      const activeDiscounts = discRows.filter((d: any) => discountActive(d))

      // Membership status per registrant (from persons.membership_type) + the event's
      // current registration count, for the member / first-N discount conditions.
      const statusByPid: Record<string, string> = {}
      if (personIds.length) {
        const mrows = await db.select({ id: schema.persons.id, membershipType: schema.persons.membershipType })
          .from(schema.persons).where(inArray(schema.persons.id, personIds))
        for (const p of mrows) statusByPid[p.id] = p.membershipType ? 'member' : 'non_member'
      }
      const [regCount] = await db.select({ n: sql<number>`count(*)` })
        .from(schema.registrations).where(eq(schema.registrations.eventId, context.id))
      const existingRegs = Number(regCount?.n ?? 0)

      const personInstances: Instance[] = []
      for (const s of subjects) {
        if ((s.kind ?? 'person') === 'entity') continue
        // A field belongs to ONE subject; remember which instance came from where so a
        // Player's fee rule can't be charged against a Parent.
        for (const inst of s.instances) { (inst as any).__subjectKey = s.key; personInstances.push(inst) }
      }
      const refDate = eventStartAt ? new Date(eventStartAt) : new Date()

      // Only the paying subjects (see chooserKeys above). Everything downstream counts
      // people off THIS list — including personCount, or a lone registrant who had to
      // name an emergency contact would trip a "2 or more people" sibling discount.
      const chargeable = chooserKeys.size
        ? personInstances.filter(i => chooserKeys.has((i as any).__subjectKey ?? ''))
        : personInstances
      // The club's ledger has to agree with the registration: invoice the paying
      // subjects only. Charging every person raised a second $25 against the
      // emergency contact — $50 in their books against a $25 registration.
      payingPersonIds = chargeable.map(i => instancePid.get(i)).filter(Boolean) as string[]

      let gross = 0
      let regIdx = existingRegs ?? 0
      const perPerson: { name: string; formText: string; amount: number }[][] = []
      for (const inst of chargeable) {
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
          personCount: chargeable.length,
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
    registrationId = randomUUID()
    await db.insert(schema.registrations).values({
      id: registrationId,
      eventId: context.id,
      personId: primaryPersonId,
      guestName: submitter?.name || null,
      guestEmail: submitter?.email || null,
      status: regStatus,
      totalAmount: String(total),
      // NOT NULL with no column default, so they have to be stated. Nothing is paid
      // at this point — an invoice registration is money owed, not money taken.
      paidAmount: '0',
      appliedDiscountTotal: String(discountTotal),
      formAnswers: fullAnswers,
    })

    // Roster — one invitee per person. Already-invited people are UPDATED to
    // CONFIRMED rather than skipped: somebody who was invited and has now paid and
    // registered is not still merely "invited".
    if (personIds.length) {
      const existingInv = await db.select({ personId: schema.invitees.personId })
        .from(schema.invitees).where(eq(schema.invitees.eventId, context.id))
      const already = new Set(existingInv.map(r => r.personId).filter(Boolean) as string[])
      const fresh = personIds.filter(pid => !already.has(pid))
      if (fresh.length) {
        await db.insert(schema.invitees).values(fresh.map(pid => ({
          id: randomUUID(), eventId: context.id!, personId: pid, status: 'CONFIRMED',
        })))
      }
      const returning = personIds.filter(pid => already.has(pid))
      if (returning.length) {
        await db.update(schema.invitees).set({ status: 'CONFIRMED' })
          .where(and(eq(schema.invitees.eventId, context.id), inArray(schema.invitees.personId, returning)))
      }
      // REGISTERING RAISES THE INVOICE, same as accepting an invitation does. This
      // is the path a stranger comes in on, so it's also where a profile gets
      // created for them over there — an invoice in the club's books has to belong
      // to somebody.
      //
      // After the registration is stored, and never allowed to fail it: somebody who
      // signed up has signed up even if the club's system is unreachable. An
      // uncharged registration can be fixed by hand; a refused one is a lost member.
      for (const pid of payingPersonIds) {
        await onAttendeeConfirmed(context.id, pid).catch(() => { /* logged inside */ })
      }
    }
    // Selected sessions across every chooser instance.
    const sessionIds = Array.from(new Set(subjects.flatMap(s => s.instances.flatMap(i => i.sessions ?? []))))
    if (sessionIds.length) {
      // The registration row was just created, so there is nothing to conflict with —
      // dedupe of the ids themselves is what the Set above is for.
      await db.insert(schema.registrationSessions).values(sessionIds.map(sid => ({
        id: randomUUID(), registrationId: registrationId!, sessionId: sid, status: 'CONFIRMED',
      })))
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
    const tgts = effectiveFormId
      ? await db.select({ targetType: schema.registrationFormTargets.targetType, targetId: schema.registrationFormTargets.targetId })
          .from(schema.registrationFormTargets).where(eq(schema.registrationFormTargets.formId, effectiveFormId))
      : []
    const allowed = new Set(tgts.filter(t => t.targetType === 'group').map(t => t.targetId))
    const codeTargets = tgts.filter(t => t.targetType === 'code').map(t => t.targetId)
    if (codeTargets.length) {
      const codes = await db.select({ id: schema.groupCodes.id, parentId: schema.groupCodes.parentId })
        .from(schema.groupCodes).where(eq(schema.groupCodes.orgId, orgId))
      const children: Record<string, string[]> = {}
      for (const c of codes) if (c.parentId) (children[c.parentId] ??= []).push(c.id)
      const expanded = new Set<string>()
      const stack = [...codeTargets]
      while (stack.length) {
        const id = stack.pop()!
        if (expanded.has(id)) continue
        expanded.add(id)
        for (const k of (children[id] ?? [])) stack.push(k)
      }
      if (expanded.size) {
        const gs = await db.select({ id: schema.memberGroups.id })
          .from(schema.memberGroups).where(inArray(schema.memberGroups.codeId, [...expanded]))
        for (const g of gs) allowed.add(g.id)
      }
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
  const submissionId = randomUUID()
  await db.insert(schema.formSubmissions).values({
    id: submissionId,
    orgId,
    formId: effectiveFormId,
    contextType: context.type,
    contextId: context.id || null,
    status: 'SUBMITTED',
    submitterName: submitter?.name || null,
    submitterEmail: submitter?.email || null,
    submitterPhone: submitter?.phone || null,
    answers: fullAnswers,
    totalAmount: String(total),
    discountTotal: String(discountTotal),
    registrationId,
  })

  // ── Staff notification ──
  const who = submitter?.name || submitter?.email || 'Someone'
  const link = context.type === 'event' ? `/events/${context.id}?tab=invitees`
    : context.type === 'group' ? `/groups/${context.id}` : '/registration'
  const notificationId = randomUUID()
  await db.insert(schema.notifications).values({
    id: notificationId,
    orgId,
    type: 'registration.created',
    title: waitlisted
      ? `New waitlist registration${contextName ? ' — ' + contextName : ''}`
      : `New registration${contextName ? ' — ' + contextName : ''}`,
    body: waitlisted
      ? `${who} joined the waitlist (class full)`
      : `${who} registered${total ? ' · ' + (totals?.currency || '') + ' ' + total.toFixed(2) : ''}`,
    link,
    payload: { context_type: context.type, context_id: context.id, submission_id: submissionId, registration_id: registrationId },
  })
  $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId } }).catch(() => {})

  return { success: true, submissionId, registrationId, personCount: personIds.length, waitlisted }
})
