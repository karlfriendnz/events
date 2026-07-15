/**
 * The one place email leaves this app.
 *
 * WHY THIS EXISTS: the club's real mailer is the (upgraded) FriendlyManager one.
 * Everything here is deliberately thin and swappable — when that lands, you
 * replace `dispatch()` and keep every call site. The rest of the app never talks
 * to Resend (or any provider) directly; it calls sendEmail().
 *
 * Today there are four hand-rolled senders (send-notification-email,
 * send-customer-booking-email, send-access-code-email, invite-person), each with
 * its own copy of dispatch/render/escape and FM navy hardcoded. New senders use
 * THIS. Retrofitting the old four is a follow-up (they work; they're just
 * duplicated).
 */

export interface EmailMessage {
  to: string
  subject: string
  /** The message body, already HTML. Use renderBrandedEmail() to build it. */
  html: string
  /** Plain-text alternative. Falls back to a stripped version of `html`. */
  text?: string
  /** Display name + address. Defaults to the platform sender. */
  from?: string
  replyTo?: string
}

export interface EmailBrand {
  name: string
  /** organisations.brand_color — the club's own colour, NOT FM navy. */
  brand_color?: string | null
  brand_text_color?: string | null
  logo_url?: string | null
}

/** FM navy — only the fallback when a club has set no brand colour of its own. */
const FALLBACK_BRAND = '#1E2157'
const FALLBACK_BRAND_TEXT = '#FFFFFF'

export function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Turn a body of plain text into HTML paragraphs, escaping as we go. */
export function textToHtml(body: string) {
  return String(body ?? '')
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export interface BrandedEmailOptions {
  brand: EmailBrand
  /** Body HTML — the club's message. */
  bodyHtml: string
  /** An optional detail card (event title, when, where) above the buttons. */
  card?: { title: string; lines: string[] }
  /** Call-to-action buttons. The first is rendered solid, the rest outlined. */
  actions?: { label: string; url: string }[]
  /** Small print under the buttons. */
  footnote?: string
}

/**
 * The club-branded shell every email we send wears: the club's logo and colour,
 * not the platform's. Inline styles only — email clients strip <style> blocks.
 */
export function renderBrandedEmail(opts: BrandedEmailOptions) {
  const { brand, bodyHtml, card, actions = [], footnote } = opts
  const bg = brand.brand_color || FALLBACK_BRAND
  const fg = brand.brand_text_color || FALLBACK_BRAND_TEXT
  const club = escapeHtml(brand.name || 'Your club')

  const header = brand.logo_url
    ? `<img src="${escapeHtml(brand.logo_url)}" alt="${club}" height="40"
         style="max-height:40px;display:block;border:0">`
    : `<span style="font-size:18px;font-weight:600;color:${fg}">${club}</span>`

  const cardHtml = card ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 20px;border:1px solid #e5e7eb;border-radius:10px">
      <tr><td style="padding:16px 18px">
        <div style="font-size:16px;font-weight:600;color:#111827;margin-bottom:6px">${escapeHtml(card.title)}</div>
        ${card.lines.filter(Boolean).map(l =>
          `<div style="font-size:14px;color:#4b5563;margin-top:2px">${escapeHtml(l)}</div>`).join('')}
      </td></tr>
    </table>` : ''

  const actionsHtml = actions.length ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px">
      <tr>${actions.map((a, i) => `
        <td style="padding-right:10px">
          <a href="${escapeHtml(a.url)}" style="display:inline-block;padding:11px 20px;border-radius:8px;
            font-size:14px;font-weight:600;text-decoration:none;
            ${i === 0
              ? `background:${bg};color:${fg};border:1px solid ${bg}`
              : 'background:#ffffff;color:#374151;border:1px solid #d1d5db'}">${escapeHtml(a.label)}</a>
        </td>`).join('')}
      </tr>
    </table>` : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f8fa">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fa">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
        style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;
               font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
        <tr><td style="background:${bg};padding:18px 24px">${header}</td></tr>
        <tr><td style="padding:24px;font-size:15px;line-height:1.6;color:#1f2937">
          ${bodyHtml}
          ${cardHtml}
          ${actionsHtml}
          ${footnote ? `<p style="margin:0;font-size:12px;color:#9ca3af">${escapeHtml(footnote)}</p>` : ''}
        </td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:12px;color:#9ca3af">Sent by ${club} via FriendlyManager</p>
    </td></tr>
  </table>
</body></html>`
}

/**
 * Hand the message to the provider.
 *
 * THIS IS THE SEAM. Swap the body of this function for the FriendlyManager
 * mailer and nothing else in the app changes. With no RESEND_KEY it logs and
 * reports `stub` — same contract as the existing senders, so local dev and CI
 * never try to post real mail.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ provider: 'resend' | 'stub'; id?: string }> {
  // Prod configures this as RESEND_API_KEY (the conventional Resend name);
  // local/.env historically used RESEND_KEY. Accept either so a name mismatch
  // never silently drops every email into the stub branch again.
  const key = process.env.RESEND_KEY || process.env.RESEND_API_KEY
  const from = msg.from || process.env.RESEND_FROM || 'FriendlyManager <onboarding@resend.dev>'

  if (!key) {
    console.log('[email:stub]', JSON.stringify({ to: msg.to, from, subject: msg.subject }))
    return { provider: 'stub' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text ?? msg.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw createError({ statusCode: 502, message: `Email provider rejected the message: ${detail || res.status}` })
  }
  const data = await res.json().catch(() => ({}))
  return { provider: 'resend', id: (data as any)?.id }
}
