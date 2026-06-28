/**
 * Customer-facing booking email. Distinct from /api/send-notification-email
 * which fans out to staff inboxes via the notifications table.
 *
 * Body:
 *   { bookingId: string, event: 'created' | 'approved' | 'declined' }
 *
 * Pulls booking + bookable + activity_mode + organisation, composes the
 * appropriate subject/body, sends to booking.contact_email via Resend.
 */
import { createClient } from '@supabase/supabase-js'

type Event = 'created' | 'approved' | 'declined'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { bookingId, event: kind } = body as { bookingId?: string; event?: Event }
  if (!bookingId || !kind) throw createError({ statusCode: 400, message: 'bookingId and event required' })

  const supabase = createClient(supabaseUrl()!, serviceKey()!)

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, start_at, end_at, contact_name, contact_email,
      bookable:bookables(id, name, location, org_id),
      activity:activities(name),
      activity_mode:activity_modes(name)
    `)
    .eq('id', bookingId)
    .maybeSingle<any>()
  if (!booking) throw createError({ statusCode: 404, message: 'booking not found' })
  if (!booking.contact_email) return { skipped: 'no-contact-email' }

  const orgId = booking.bookable?.org_id
  let orgName = 'FriendlyManager'
  if (orgId) {
    const { data: org } = await supabase.from('organisations').select('name').eq('id', orgId).maybeSingle<any>()
    if (org?.name) orgName = org.name
  }

  const startStr = booking.start_at
    ? new Date(booking.start_at).toLocaleString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : ''
  const reference = booking.id.replace(/-/g, '').slice(0, 8).toUpperCase()
  const baseUrl = process.env.NUXT_PUBLIC_BASE_URL ?? 'http://localhost:3002'
  const lookupUrl = `${baseUrl}/booking/${reference}`

  const subject = subjectFor(kind, booking.status, orgName)
  const text = textFor(kind, {
    name: booking.contact_name || 'there',
    bookable: booking.bookable?.name ?? 'the venue',
    location: booking.bookable?.location ?? null,
    activity: booking.activity?.name ?? null,
    mode: booking.activity_mode?.name ?? null,
    when: startStr,
    orgName,
    reference,
    lookupUrl,
  })

  const result = await dispatch({ to: [booking.contact_email], subject, text, orgName })
  return { sent: 1, recipient: booking.contact_email, provider: result.provider, providerId: result.id ?? null }
})

function subjectFor(kind: Event, status: string, orgName: string): string {
  if (kind === 'declined')   return `Your booking with ${orgName} couldn't be confirmed`
  if (kind === 'approved')   return `Your booking with ${orgName} is confirmed`
  // 'created' — branch on the booking's status
  if (status === 'PENDING')  return `Booking received — ${orgName} will confirm shortly`
  return `Your booking with ${orgName} is confirmed`
}

interface Ctx {
  name: string
  bookable: string
  location: string | null
  activity: string | null
  mode: string | null
  when: string
  orgName: string
  reference: string
  lookupUrl: string
}

function textFor(kind: Event, c: Ctx): string {
  const detailLines = [
    c.activity ? `Activity: ${c.activity}${c.mode ? ` (${c.mode})` : ''}` : null,
    `Venue: ${c.bookable}${c.location ? ` — ${c.location}` : ''}`,
    `When: ${c.when}`,
    `Reference: ${c.reference}`,
  ].filter(Boolean).join('\n')

  const footer = `View your booking any time: ${c.lookupUrl}`

  if (kind === 'declined') {
    return [
      `Hi ${c.name},`,
      '',
      `Unfortunately your booking with ${c.orgName} couldn't be confirmed at this time.`,
      '',
      detailLines,
      '',
      `If you have any questions please reply to this email and the team will be in touch.`,
      '',
      footer,
    ].join('\n')
  }
  if (kind === 'approved') {
    return [
      `Hi ${c.name},`,
      '',
      `Good news — your booking with ${c.orgName} has been confirmed.`,
      '',
      detailLines,
      '',
      `See you then!`,
      '',
      footer,
    ].join('\n')
  }
  // 'created'
  return [
    `Hi ${c.name},`,
    '',
    `Thanks for booking with ${c.orgName}. Here are the details we have:`,
    '',
    detailLines,
    '',
    `If anything looks wrong, just reply to this email.`,
    '',
    footer,
  ].join('\n')
}

async function dispatch(msg: { to: string[]; subject: string; text: string; orgName: string }) {
  const key = process.env.RESEND_KEY
  if (!key) {
    // eslint-disable-next-line no-console
    console.log('[email:stub:customer] (set RESEND_KEY to actually send)\n', JSON.stringify({ to: msg.to, subject: msg.subject, text: msg.text }, null, 2))
    return { provider: 'stub' as const }
  }
  const from = process.env.RESEND_FROM ?? `${msg.orgName} <onboarding@resend.dev>`
  const html = renderHtml(msg)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: msg.to, subject: msg.subject, text: msg.text, html }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    // eslint-disable-next-line no-console
    console.error('[email:resend:customer] failed', res.status, detail)
    throw createError({ statusCode: 502, message: `Resend send failed: ${res.status} ${detail.slice(0, 200)}` })
  }
  const json = await res.json().catch(() => ({}))
  return { provider: 'resend' as const, id: json?.id }
}

function renderHtml(msg: { subject: string; text: string }) {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(msg.subject)}</h1>
<pre style="white-space:pre-wrap;font-family:inherit;color:#4b5563;line-height:1.55;margin:0">${escapeHtml(msg.text)}</pre>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:12px;color:#9ca3af">Automated message — please reply with any questions.</p>
</body></html>`
}
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
