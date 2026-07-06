// Xero OAuth2 + API helpers (server-side only — tokens never reach the client).
// Auto-imported into server routes (server/utils).
//
// Hard-won rules baked in (from the PupManager + legacy FM integrations):
//  - Xero ROTATES the refresh token on every refresh — persist the new one every
//    time or the connection silently dies (getValidAccessToken does this).
//  - Never request the app.connections scope (auto-granted; asking → access_denied).
//  - Scope spaces must be %20-encoded in the authorize URL, never '+'.
import crypto from 'node:crypto'

// NB: no app.connections here on purpose.
const XERO_SCOPES = 'offline_access accounting.contacts accounting.invoices accounting.payments accounting.settings.read'
const TOKEN_URL = 'https://identity.xero.com/connect/token'
const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize'
const CONNECTIONS_URL = 'https://api.xero.com/connections'
const API_BASE = 'https://api.xero.com/api.xro/2.0'
const EXPIRY_SKEW_MS = 60_000
const STATE_TTL_MS = 10 * 60 * 1000

export function xeroClientId(): string | undefined { return process.env.XERO_CLIENT_ID }
export function xeroClientSecret(): string | undefined { return process.env.XERO_CLIENT_SECRET }
export function xeroConfigured(): boolean { return !!(xeroClientId() && xeroClientSecret()) }

function basicAuth(): string {
  return 'Basic ' + Buffer.from(`${xeroClientId()}:${xeroClientSecret()}`).toString('base64')
}

// ── CSRF state: HMAC-signed, stateless (no session store needed) ──
// Format: <orgId>.<ts>.<hmac>  (org uuid contains no dots)
export function signXeroState(orgId: string): string {
  const ts = Date.now().toString()
  const mac = crypto.createHmac('sha256', xeroClientSecret()!).update(`${orgId}.${ts}`).digest('hex')
  return `${orgId}.${ts}.${mac}`
}

export function verifyXeroState(state: string | undefined): string | null {
  if (!state) return null
  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [orgId, ts, mac] = parts
  const expect = crypto.createHmac('sha256', xeroClientSecret()!).update(`${orgId}.${ts}`).digest('hex')
  const a = Buffer.from(mac); const b = Buffer.from(expect)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  if (Date.now() - Number(ts) > STATE_TTL_MS) return null
  return orgId
}

// ── OAuth ──
export function xeroAuthorizeUrl(state: string, redirectUri: string): string {
  // Built by hand so the scope separator is %20 (encodeURIComponent), not '+'.
  return `${AUTHORIZE_URL}?response_type=code`
    + `&client_id=${encodeURIComponent(xeroClientId()!)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&scope=${encodeURIComponent(XERO_SCOPES)}`
    + `&state=${encodeURIComponent(state)}`
}

export interface XeroTokenSet { access_token: string; refresh_token: string; expires_in: number }

async function tokenRequest(body: Record<string, string>): Promise<XeroTokenSet> {
  return await $fetch<XeroTokenSet>(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })
}

export function exchangeCodeForTokens(code: string, redirectUri: string) {
  return tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri })
}

export function refreshXeroTokens(refreshToken: string) {
  return tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

export interface XeroTenant { id: string; tenantId: string; tenantName: string; tenantType: string; updatedDateUtc?: string }

export async function fetchXeroConnections(accessToken: string): Promise<XeroTenant[]> {
  return await $fetch<XeroTenant[]>(CONNECTIONS_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
}

/** Best-effort: remove this app from the user's connected-apps list in Xero. */
export async function revokeXeroConnections(accessToken: string): Promise<void> {
  try {
    const conns = await fetchXeroConnections(accessToken)
    for (const c of conns) {
      await $fetch(`${CONNECTIONS_URL}/${c.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }).catch(() => {})
    }
  } catch { /* best-effort */ }
}

// ── Token lifecycle against a xero_connections row ──
/**
 * Returns a valid access token for the connection row, refreshing (and
 * PERSISTING the rotated refresh token) when stale. On unrecoverable refresh
 * failure the row is marked offline and null is returned.
 */
export async function getValidAccessToken(supabase: any, conn: any): Promise<string | null> {
  const expiresAt = conn.access_token_expires_at ? new Date(conn.access_token_expires_at).getTime() : 0
  if (conn.access_token && expiresAt - EXPIRY_SKEW_MS > Date.now()) return conn.access_token
  try {
    const tok = await refreshXeroTokens(conn.refresh_token)
    await supabase.from('xero_connections').update({
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,   // rotated — must persist every time
      access_token_expires_at: new Date(Date.now() + tok.expires_in * 1000).toISOString(),
      status: 'online',
      updated_at: new Date().toISOString(),
    }).eq('id', conn.id)
    conn.access_token = tok.access_token
    conn.refresh_token = tok.refresh_token
    return tok.access_token
  } catch (e) {
    console.error('[xero] token refresh failed — marking connection offline', e)
    await supabase.from('xero_connections').update({ status: 'offline', updated_at: new Date().toISOString() }).eq('id', conn.id)
    return null
  }
}

/** Authenticated accounting-API GET for a connection (adds tenant header). */
export async function xeroGet<T = any>(accessToken: string, tenantId: string, path: string): Promise<T> {
  return await $fetch<T>(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' },
  })
}
