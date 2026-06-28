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
  } else if (formId) {
    const { data: f } = await supabase.from('registration_forms').select('org_id, name').eq('id', formId).maybeSingle()
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
  const personIds: string[] = []
  let primaryPersonId: string | null = null
  for (const s of subjects) {
    if ((s.kind ?? 'person') === 'entity') continue
    for (const inst of s.instances) {
      const pid = await upsertPerson(inst)
      if (pid) { personIds.push(pid); if (!primaryPersonId) primaryPersonId = pid }
    }
  }

  const total = Number(totals?.total) || 0
  const fullAnswers = { subjects, payment, termsAccepted, totals }
  let registrationId: string | null = null

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
  } else if (context.type === 'group') {
    // Add each registered person to the group.
    if (personIds.length) {
      await supabase.from('member_group_memberships').upsert(
        personIds.map(pid => ({ group_id: context.id, person_id: pid })),
        { onConflict: 'group_id,person_id', ignoreDuplicates: true },
      )
    }
  }
  // (competition / enquiry / other contexts: the generic submission row below is
  //  the record of truth; richer materialisation can be added per context.)

  // ── Uniform submission record ──
  const { data: sub, error: sErr } = await supabase.from('form_submissions').insert({
    org_id: orgId,
    form_id: formId || null,
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
    title: `New registration${contextName ? ' — ' + contextName : ''}`,
    body: `${who} registered${total ? ' · ' + (totals?.currency || '') + ' ' + total.toFixed(2) : ''}`,
    link,
    payload: { context_type: context.type, context_id: context.id, submission_id: sub.id, registration_id: registrationId },
  }).select('id').single()
  if (notif?.id) {
    $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: notif.id } }).catch(() => {})
  }

  return { success: true, submissionId: sub.id, registrationId, personCount: personIds.length }
})
