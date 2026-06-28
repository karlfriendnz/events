/**
 * Sends the booker their access code for an access-controlled venue booking.
 *
 * Body: { bookingId: string }
 *
 * Pulls booking + bookable + organisation, composes an email with the code,
 * the venue, the booking window, and unlock instructions. Delivers via
 * Resend (same path as send-customer-booking-email).
 */
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { bookingId } = body as { bookingId?: string }
  if (!bookingId) throw createError({ statusCode: 400, message: 'bookingId required' })

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, start_at, end_at, contact_name, contact_email, access_code,
      bookable:bookables(
        id, name, location, org_id,
        access_unlock_before_mins, access_unlock_after_mins
      )
    `)
    .eq('id', bookingId)
    .maybeSingle<any>()

  if (!booking) throw createError({ statusCode: 404, message: 'booking not found' })
  if (!booking.access_code) return { skipped: 'no-code' }
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

  const beforeMins = booking.bookable?.access_unlock_before_mins ?? 5
  const afterMins  = booking.bookable?.access_unlock_after_mins ?? 5

  const subject = `Your access code for ${booking.bookable?.name ?? 'your booking'}`
  const text = [
    `Hi ${booking.contact_name || 'there'},`,
    '',
    `Your booking at ${booking.bookable?.name ?? 'the venue'} is confirmed for ${startStr}.`,
    booking.bookable?.location ? `Location: ${booking.bookable.location}` : null,
    '',
    `Use this code to enter:`,
    '',
    `   ${booking.access_code}`,
    '',
    `The door unlocks ${beforeMins} minute${beforeMins === 1 ? '' : 's'} before your booking starts and stays open ${afterMins} minute${afterMins === 1 ? '' : 's'} after it ends.`,
    '',
    `If you have any questions just reply to this email.`,
  ].filter(Boolean).join('\n')

  const result = await dispatch({ to: [booking.contact_email], subject, text, code: booking.access_code, orgName })
  return { sent: 1, recipient: booking.contact_email, provider: result.provider, providerId: result.id ?? null }
})

async function dispatch(msg: { to: string[]; subject: string; text: string; code: string; orgName: string }) {
  const key = process.env.RESEND_KEY
  if (!key) {
    // eslint-disable-next-line no-console
    console.log('[email:stub:access] (set RESEND_KEY to actually send)\n', JSON.stringify({ to: msg.to, subject: msg.subject, text: msg.text }, null, 2))
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
    console.error('[email:resend:access] failed', res.status, detail)
    throw createError({ statusCode: 502, message: `Resend send failed: ${res.status} ${detail.slice(0, 200)}` })
  }
  const json = await res.json().catch(() => ({}))
  return { provider: 'resend' as const, id: json?.id }
}

function renderHtml(msg: { subject: string; text: string; code: string }) {
  const codeBlock = `<div style="margin:16px 0;padding:20px;background:#F3F4F6;border-radius:12px;text-align:center;font-family:ui-monospace,SFMono-Regular,monospace;font-size:32px;letter-spacing:6px;color:#1E2157;font-weight:600">${escapeHtml(msg.code)}</div>`
  const textWithoutCode = msg.text.replace(/\n\s*\d{4,12}\s*\n/, '\n[code below]\n')
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(msg.subject)}</h1>
<pre style="white-space:pre-wrap;font-family:inherit;color:#4b5563;line-height:1.55;margin:0">${escapeHtml(textWithoutCode.split('[code below]')[0])}</pre>
${codeBlock}
<pre style="white-space:pre-wrap;font-family:inherit;color:#4b5563;line-height:1.55;margin:0">${escapeHtml(textWithoutCode.split('[code below]')[1] ?? '')}</pre>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:12px;color:#9ca3af">Automated message — please reply with any questions.</p>
</body></html>`
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
