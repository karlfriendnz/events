// Xero OAuth callback: verifies state, exchanges the code, resolves the tenant,
// and upserts the org's xero_connections row. Always redirects back to
// /settings/xero with ?connected=1 or ?error=<code>.
//
// Reconnect safety (legacy FM rule): if the org was previously connected, only
// accept the SAME tenant — never silently repoint a club at a different Xero
// org (that would mis-map every stored Xero id).
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const back = (err?: string) => sendRedirect(event, err ? `/settings/xero?error=${err}` : '/settings/xero?connected=1')

  if (q.error) return back(String(q.error))                    // user denied consent etc.
  const orgId = verifyXeroState(q.state as string | undefined)
  if (!orgId) return back('bad-state')
  if (!q.code) return back('no-code')

  try {
    const redirectUri = process.env.XERO_REDIRECT_URI || `${getRequestURL(event).origin}/api/xero/callback`
    const tok = await exchangeCodeForTokens(String(q.code), redirectUri)

    // Resolve which Xero organisation was authorised.
    const conns = await fetchXeroConnections(tok.access_token)
    const tenants = conns.filter(c => c.tenantType === 'ORGANISATION')
      .sort((a, b) => (b.updatedDateUtc ?? '').localeCompare(a.updatedDateUtc ?? ''))
    if (!tenants.length) return back('no-tenant')

    const supabase = createClient(supabaseUrl()!, serviceKey()!)
    const { data: existing } = await supabase.from('xero_connections')
      .select('id, tenant_id').eq('org_id', orgId).maybeSingle()

    // Reconnect: must be the same tenant as before.
    let tenant = tenants[0]
    if (existing) {
      const match = tenants.find(t => t.tenantId === existing.tenant_id)
      if (!match) return back('tenant-mismatch')
      tenant = match
    }

    const row = {
      org_id: orgId,
      tenant_id: tenant.tenantId,
      tenant_name: tenant.tenantName,
      refresh_token: tok.refresh_token,
      access_token: tok.access_token,
      access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
      status: 'online',
      updated_at: new Date().toISOString(),
    }
    if (existing) await supabase.from('xero_connections').update(row).eq('id', existing.id)
    else await supabase.from('xero_connections').insert(row)

    return back()
  } catch (e) {
    console.error('[xero] callback failed', e)
    return back('exchange-failed')
  }
})
