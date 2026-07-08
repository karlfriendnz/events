// Send a login invite to a person. Creates (or re-links) their Supabase auth
// account by email, generates a set-password action link, and emails it via
// Resend (branded). The person then lands on /set-password to choose a password.
// One login can belong to several clubs — the auth user is keyed by email, and
// on login we match that email to every persons row across orgs (see /clubs).
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const personId = body?.personId as string
  if (!personId) throw createError({ statusCode: 400, message: 'personId required' })

  const url = supabaseUrl()
  const key = serviceKey()
  if (!url || !key) throw createError({ statusCode: 500, message: 'Server not configured' })
  const admin = createClient(url, key)

  const { data: person } = await (admin.from as any)('persons')
    .select('id, first_name, last_name, email, org_id').eq('id', personId).maybeSingle()
  if (!person) throw createError({ statusCode: 404, message: 'Person not found' })
  if (!person.email?.trim()) throw createError({ statusCode: 400, message: 'This person has no email — add one first.' })
  const email = person.email.trim()

  const origin = getRequestHeader(event, 'origin') || `https://${getRequestHeader(event, 'host')}`
  const redirectTo = `${origin}/set-password`

  // Generate a set-password link. 'invite' for a brand-new login; if the email
  // already has an account, fall back to 'recovery' (reset password).
  let actionLink: string | null = null
  let mode: 'invite' | 'recovery' = 'invite'
  const inv = await admin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } } as any)
  if (inv.error) {
    mode = 'recovery'
    const rec = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } } as any)
    if (rec.error) throw createError({ statusCode: 502, message: rec.error.message })
    actionLink = (rec.data as any)?.properties?.action_link ?? null
  } else {
    actionLink = (inv.data as any)?.properties?.action_link ?? null
  }
  if (!actionLink) throw createError({ statusCode: 502, message: 'Could not create the set-password link.' })

  // Club name for the email.
  const { data: org } = await (admin.from as any)('organisations').select('name').eq('id', person.org_id).maybeSingle()
  const clubName = org?.name ?? 'your club'
  const first = person.first_name || 'there'

  // Send via Resend (branded). Falls back to a stub log when RESEND_KEY isn't set.
  const rkey = process.env.RESEND_KEY
  let emailStatus: 'sent' | 'stub' | 'error' = 'stub'
  const subject = `Set up your ${clubName} login`
  const text = `Hi ${first},\n\nYou've been given access to ${clubName} on FriendlyManager. Click the button below to set your password and sign in.\n\nIf you belong to more than one club, this single login connects to all of them.`
  if (rkey) {
    try {
      const from = process.env.RESEND_FROM ?? 'FriendlyManager <onboarding@resend.dev>'
      const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2937;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:18px;margin:0 0 12px">Set up your ${escapeHtml(clubName)} login</h1>
<p style="color:#4b5563;line-height:1.55">Hi ${escapeHtml(first)}, you've been given access to <b>${escapeHtml(clubName)}</b>. Set your password to sign in.</p>
<p style="margin:24px 0"><a href="${actionLink}" style="display:inline-block;padding:11px 20px;background:#1E2157;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Set your password</a></p>
<p style="font-size:13px;color:#6b7280">One login connects to every club you belong to.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:12px;color:#9ca3af">If you didn't expect this, you can ignore this email.</p>
</body></html>`
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${rkey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject, text, html }),
      })
      emailStatus = res.ok ? 'sent' : 'error'
      if (!res.ok) console.error('[invite:resend]', res.status, await res.text().catch(() => ''))
    } catch (e) { emailStatus = 'error'; console.error('[invite:resend]', e) }
  } else {
    console.log('[invite:stub] set RESEND_KEY to send.\n', JSON.stringify({ to: email, link: actionLink }, null, 2))
  }

  // Stamp invite status on the person.
  await (admin.from as any)('persons').update({ invited_at: new Date().toISOString() }).eq('id', personId)

  // Return the link too, so the UI can offer a copyable fallback when email
  // delivery isn't configured yet.
  return { ok: true, mode, emailStatus, link: actionLink }
})

function escapeHtml(s: string) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
