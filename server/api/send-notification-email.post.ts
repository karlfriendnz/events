/**
 * Sends an email for a single notification row.
 *
 * Right now this is a STUB — it composes the message, logs it to the server
 * console, and stamps `email_sent_at` so we can see deliveries in the dashboard.
 *
 * To go live: pick a provider (Resend / SendGrid / Postmark / your SMTP) and
 * replace `dispatch()` below.
 *
 * Recipients are the org's managers — `org_manager_grants` joined onto `persons`,
 * whose row already carries the email. This used to read `org_members` and resolve
 * every `user_id` through Supabase auth, which is the only reason the route needed
 * Supabase at all: org_members holds no email itself, so there was nothing to send
 * to without that second hop.
 *
 * The endpoint is called fire-and-forget from the registration + booking submit
 * paths, but it's safe to retry — `email_sent_at` is the idempotency key.
 */
import { and, eq, isNotNull, ne } from 'drizzle-orm'
import { db, schema } from '../db/client'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { notificationId } = body as { notificationId?: string }
  if (!notificationId) throw createError({ statusCode: 400, message: 'notificationId required' })

  const [row] = await db.select({
    id: schema.notifications.id,
    orgId: schema.notifications.orgId,
    title: schema.notifications.title,
    body: schema.notifications.body,
    link: schema.notifications.link,
    emailSentAt: schema.notifications.emailSentAt,
  }).from(schema.notifications).where(eq(schema.notifications.id, notificationId)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'notification not found' })
  if (row.emailSentAt) return { skipped: 'already-sent' }

  // Recipients: the org's managers. Replace with a finer-grained model (e.g. only
  // those with this notification type toggled on in their preferences) when the
  // user model gets richer.
  const managers = await db.selectDistinct({ email: schema.persons.email })
    .from(schema.orgManagerGrants)
    .innerJoin(schema.persons, eq(schema.persons.id, schema.orgManagerGrants.personId))
    .where(and(
      eq(schema.orgManagerGrants.orgId, row.orgId),
      isNotNull(schema.persons.email),
      ne(schema.persons.email, ''),
    ))
  const recipients = managers.map(m => m.email).filter(Boolean) as string[]
  if (!recipients.length) return { skipped: 'no-recipients' }

  // Compose. Keep this minimal — the link will appear as a CTA so staff can
  // jump into the booking from their inbox.
  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL ?? 'http://localhost:3002'
  const subject = row.title
  const text = [
    row.title,
    row.body ?? '',
    '',
    row.link ? `Open: ${baseUrl}${row.link}` : '',
  ].filter(Boolean).join('\n')

  const result = await dispatch({ to: recipients, subject, text, link: row.link, baseUrl })

  await db.update(schema.notifications)
    .set({ emailSentAt: new Date() })
    .where(eq(schema.notifications.id, row.id))

  return { sent: recipients.length, recipients, provider: result.provider, providerId: result.id ?? null }
})

/**
 * Email dispatcher. Uses Resend if `RESEND_KEY` is set in env, otherwise
 * falls back to a console log so dev doesn't break before keys are wired.
 *
 * Resend's `onboarding@resend.dev` address works without domain verification,
 * which is fine for a prototype. Set `RESEND_FROM` once you've verified a
 * sending domain.
 */
async function dispatch(msg: { to: string[]; subject: string; text: string; link: string | null; baseUrl: string }) {
  const key = process.env.RESEND_KEY || process.env.RESEND_API_KEY
  if (!key) {
    // eslint-disable-next-line no-console
    console.log('[email:stub] (set RESEND_KEY to actually send)\n', JSON.stringify({ to: msg.to, subject: msg.subject, text: msg.text }, null, 2))
    return { provider: 'stub' as const }
  }

  const from = process.env.RESEND_FROM ?? 'FriendlyManager <onboarding@resend.dev>'
  const html = renderHtml(msg)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: msg.to, subject: msg.subject, text: msg.text, html }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // eslint-disable-next-line no-console
    console.error('[email:resend] failed', res.status, detail)
    throw createError({ statusCode: 502, message: `Resend send failed: ${res.status} ${detail.slice(0, 200)}` })
  }
  const json = await res.json().catch(() => ({}))
  return { provider: 'resend' as const, id: json?.id }
}

function renderHtml(msg: { subject: string; text: string; link: string | null; baseUrl: string }) {
  const cta = msg.link
    ? `<p style="margin:24px 0"><a href="${msg.baseUrl}${msg.link}" style="display:inline-block;padding:10px 18px;background:#1E2157;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Open booking</a></p>`
    : ''
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(msg.subject)}</h1>
<p style="white-space:pre-line;color:#4b5563;line-height:1.55">${escapeHtml(msg.text.replace(msg.subject, '').trim())}</p>
${cta}
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:12px;color:#9ca3af">FriendlyManager Events — automated message</p>
</body></html>`
}
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
