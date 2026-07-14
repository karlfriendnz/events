import { createClient } from '@supabase/supabase-js'
import { substituteEventTokens, DEFAULT_INVITATION } from '../../composables/useEventTokens'
import { sendEmail, renderBrandedEmail, textToHtml } from '../utils/email'

/**
 * Send the invitation email for an event.
 *
 * The FIRST real send path in the app: the event Communication tab's existing
 * "send" only ever inserted a communications row with status SENT and mailed
 * nobody. This resolves actual recipients, substitutes each person's merge
 * fields, and records what genuinely happened (including failures).
 *
 * The email adapts to what the event ASKS OF PEOPLE — the same dial the wizard
 * sets: an RSVP event gets yes/no buttons pointing at /rsvp/:event/:person; an
 * event with a form gets a Register button pointing at /r/event/:id. We never ask
 * someone to RSVP to an event that wants a full registration, or vice versa.
 *
 * Template resolution (first hit wins): this event's override → the club's
 * default (email_templates 'event_invitation') → DEFAULT_INVITATION in code.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { eventId, subject, body: messageBody, personIds, resend } = body as {
    eventId: string
    /** Optional one-off overrides for this send; otherwise the saved template. */
    subject?: string
    body?: string
    /** Limit to specific invitees. Omitted = everyone invited. */
    personIds?: string[]
    /** Include people already sent an invitation. Default false — don't spam. */
    resend?: boolean
  }

  if (!eventId) throw createError({ statusCode: 400, message: 'Missing event' })

  const supabase = createClient(supabaseUrl()!, serviceKey()!)

  // NB `locations` (jsonb array, migration 004) — there is no `location` column.
  const { data: ev, error: evErr } = await supabase.from('events')
    .select('id, org_id, title, start_at, locations, address, form_id, status, invitation_email')
    .eq('id', eventId).maybeSingle()
  if (evErr) throw createError({ statusCode: 500, message: evErr.message })
  if (!ev) throw createError({ statusCode: 404, message: 'Event not found' })
  if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') {
    throw createError({ statusCode: 409, message: 'This event has been cancelled.' })
  }

  const { data: org } = await supabase.from('organisations')
    .select('id, name, brand_color, brand_text_color, logo_url').eq('id', ev.org_id).maybeSingle()

  // ── The wording: event override → club default → code default ──
  const { data: tpl } = await supabase.from('email_templates')
    .select('subject, body').eq('org_id', ev.org_id).eq('key', 'event_invitation').maybeSingle()
  const override = (ev.invitation_email ?? {}) as { subject?: string; body?: string }
  const finalSubject = subject ?? override.subject ?? tpl?.subject ?? DEFAULT_INVITATION.subject
  const finalBody = messageBody ?? override.body ?? tpl?.body ?? DEFAULT_INVITATION.body

  // ── Recipients: invitees with an email we can actually reach ──
  let q = supabase.from('invitees')
    .select('id, person_id, invite_sent_at, persons(id, first_name, last_name, email)')
    .eq('event_id', eventId)
  if (personIds?.length) q = q.in('person_id', personIds)
  const { data: invitees } = await q

  const recipients = (invitees ?? []).filter((i: any) => {
    if (!i.persons?.email) return false            // nothing to send to
    if (!resend && i.invite_sent_at) return false  // already told
    return true
  })

  // Where the event is, in one line — the same summary the RSVP page shows.
  const loc = (ev.locations as any[])?.[0]
  const venue = loc?.name ?? loc?.address ?? ev.address ?? ''

  const origin = getRequestURL(event).origin
  // What are we ASKING them to do? A form event wants a registration; otherwise
  // the answer is simply yes or no.
  const wantsForm = !!ev.form_id

  const ctxBase = {
    eventTitle: ev.title,
    startAt: ev.start_at,
    venueName: venue ?? '',
    clubName: org?.name ?? '',
  }

  const results = { sent: 0, failed: 0, skipped: (invitees?.length ?? 0) - recipients.length }
  const errors: string[] = []

  for (const inv of recipients as any[]) {
    const person = inv.persons
    const ctx = { ...ctxBase, firstName: person.first_name, lastName: person.last_name }

    const actions = wantsForm
      ? [{ label: 'Register', url: `${origin}/r/event/${ev.id}` }]
      : [
          { label: "Yes, I'll be there", url: `${origin}/rsvp/${ev.id}/${person.id}` },
          { label: "Can't make it", url: `${origin}/rsvp/${ev.id}/${person.id}` },
        ]

    const html = renderBrandedEmail({
      brand: {
        name: org?.name ?? 'Your club',
        brand_color: org?.brand_color,
        brand_text_color: org?.brand_text_color,
        logo_url: org?.logo_url,
      },
      bodyHtml: textToHtml(substituteEventTokens(finalBody, ctx)),
      card: {
        title: ev.title,
        lines: [
          ev.start_at
            ? new Date(ev.start_at).toLocaleString('en-GB', {
                weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit',
              })
            : 'Date to be confirmed',
          venue ?? '',
        ],
      },
      actions,
      footnote: wantsForm ? undefined : 'Tap an answer above — it takes one click, no login needed.',
    })

    try {
      await sendEmail({
        to: person.email,
        subject: substituteEventTokens(finalSubject, ctx),
        html,
        from: org?.name ? `${org.name} <${process.env.RESEND_FROM_ADDRESS || 'onboarding@resend.dev'}>` : undefined,
      })
      await supabase.from('invitees').update({ invite_sent_at: new Date().toISOString() }).eq('id', inv.id)
      results.sent++
    } catch (e: any) {
      results.failed++
      errors.push(`${person.email}: ${e?.message ?? 'send failed'}`)
    }
  }

  // Record what ACTUALLY happened. (The Communication tab's own "send" writes
  // status:'SENT' unconditionally without mailing anyone — this doesn't.)
  await supabase.from('communications').insert({
    event_id: eventId,
    channel: 'EMAIL',
    subject: finalSubject,
    body: finalBody,
    recipient_count: results.sent,
    status: results.failed && !results.sent ? 'FAILED' : 'SENT',
    sent_at: new Date().toISOString(),
  })

  return { ...results, errors: errors.slice(0, 5) }
})
