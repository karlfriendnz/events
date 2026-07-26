import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../db/client'
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
 *
 * ON THE SEAM (ported 24 Jul 2026). This read Supabase while events have long been
 * created through /api/v1 → MySQL, so it 404'd "Event not found" for EVERY event
 * the app can make — the endpoint was dead, silently, and the quick-event "Send
 * invite" checkbox is what finally surfaced it. It now reads the same DB the rest
 * of the event stack writes. Deliberately still a plain route, not a repository
 * function: it's a side-effecting action (send mail), not storage.
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

  // NB `locations` (json array) — there is no `location` column.
  const [ev] = await db.select({
    id: schema.events.id,
    orgId: schema.events.orgId,
    title: schema.events.title,
    startAt: schema.events.startAt,
    locations: schema.events.locations,
    address: schema.events.address,
    formId: schema.events.formId,
    status: schema.events.status,
    invitationEmail: schema.events.invitationEmail,
  }).from(schema.events).where(eq(schema.events.id, eventId)).limit(1)

  if (!ev) throw createError({ statusCode: 404, message: 'Event not found' })
  if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') {
    throw createError({ statusCode: 409, message: 'This event has been cancelled.' })
  }

  const [org] = await db.select({
    id: schema.organisations.id,
    name: schema.organisations.name,
    brandColor: schema.organisations.brandColor,
    brandTextColor: schema.organisations.brandTextColor,
    logoUrl: schema.organisations.logoUrl,
  }).from(schema.organisations).where(eq(schema.organisations.id, ev.orgId)).limit(1)

  // ── The wording: event override → club default → code default ──
  const [tpl] = await db.select({ subject: schema.emailTemplates.subject, body: schema.emailTemplates.body })
    .from(schema.emailTemplates)
    .where(and(eq(schema.emailTemplates.orgId, ev.orgId), eq(schema.emailTemplates.key, 'event_invitation')))
    .limit(1)
  // mysql2 usually parses json columns; a raw string is tolerated rather than thrown at.
  const override = ((): { subject?: string; body?: string } => {
    const raw: any = ev.invitationEmail
    if (!raw) return {}
    if (typeof raw === 'string') { try { return JSON.parse(raw) ?? {} } catch { return {} } }
    return raw
  })()
  const finalSubject = subject ?? override.subject ?? tpl?.subject ?? DEFAULT_INVITATION.subject
  const finalBody = messageBody ?? override.body ?? tpl?.body ?? DEFAULT_INVITATION.body

  // ── Recipients: invitees with an email we can actually reach ──
  const inviteeRows = await db.select({
    id: schema.invitees.id,
    personId: schema.invitees.personId,
    inviteSentAt: schema.invitees.inviteSentAt,
    firstName: schema.persons.firstName,
    lastName: schema.persons.lastName,
    email: schema.persons.email,
  })
    .from(schema.invitees)
    .innerJoin(schema.persons, eq(schema.persons.id, schema.invitees.personId))
    .where(personIds?.length
      ? and(eq(schema.invitees.eventId, eventId), inArray(schema.invitees.personId, personIds))
      : eq(schema.invitees.eventId, eventId))

  const recipients = inviteeRows.filter((i) => {
    if (!i.email) return false            // nothing to send to
    if (!resend && i.inviteSentAt) return false  // already told
    return true
  })

  // Where the event is, in one line — the same summary the RSVP page shows.
  const locs: any = typeof ev.locations === 'string' ? (() => { try { return JSON.parse(ev.locations as any) } catch { return [] } })() : ev.locations
  const loc = Array.isArray(locs) ? locs[0] : null
  const venue = loc?.name ?? loc?.address ?? ev.address ?? ''

  const origin = getRequestURL(event).origin
  // What are we ASKING them to do? A form event wants a registration; otherwise
  // the answer is simply yes or no.
  const wantsForm = !!ev.formId

  const ctxBase = {
    eventTitle: ev.title,
    startAt: ev.startAt ? new Date(ev.startAt).toISOString() : null,
    venueName: venue ?? '',
    clubName: org?.name ?? '',
  }

  const results = { sent: 0, failed: 0, skipped: inviteeRows.length - recipients.length }
  const errors: string[] = []

  for (const inv of recipients) {
    const ctx = { ...ctxBase, firstName: inv.firstName, lastName: inv.lastName }

    const actions = wantsForm
      ? [{ label: 'Register', url: `${origin}/r/event/${ev.id}` }]
      : [
          { label: "Yes, I'll be there", url: `${origin}/rsvp/${ev.id}/${inv.personId}` },
          { label: "Can't make it", url: `${origin}/rsvp/${ev.id}/${inv.personId}` },
        ]

    const html = renderBrandedEmail({
      brand: {
        name: org?.name ?? 'Your club',
        brand_color: org?.brandColor ?? undefined,
        brand_text_color: org?.brandTextColor ?? undefined,
        logo_url: org?.logoUrl ?? undefined,
      },
      bodyHtml: textToHtml(substituteEventTokens(finalBody, ctx)),
      card: {
        title: ev.title,
        lines: [
          ev.startAt
            ? new Date(ev.startAt).toLocaleString('en-GB', {
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
        to: inv.email!,
        subject: substituteEventTokens(finalSubject, ctx),
        html,
        from: org?.name ? `${org.name} <${process.env.RESEND_FROM_ADDRESS || 'onboarding@resend.dev'}>` : undefined,
      })
      await db.update(schema.invitees).set({ inviteSentAt: new Date() }).where(eq(schema.invitees.id, inv.id))
      results.sent++
    } catch (e: any) {
      results.failed++
      errors.push(`${inv.email}: ${e?.message ?? 'send failed'}`)
    }
  }

  // Record what ACTUALLY happened. (The Communication tab's own "send" writes a row
  // unconditionally without mailing anyone — this doesn't.) NB the MySQL
  // `communications` table has no channel/status columns, so what happened is carried
  // by `recipient_count` (0 = nothing left the building).
  if (recipients.length) {
    await db.insert(schema.communications).values({
      id: randomUUID(),
      eventId,
      subject: finalSubject,
      body: finalBody,
      recipientCount: results.sent,
      sentAt: new Date(),
    })
  }

  return { ...results, errors: errors.slice(0, 5) }
})
