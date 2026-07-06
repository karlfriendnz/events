// Starts the Xero OAuth consent flow for an org: /api/xero/connect?org=<orgId>
// Redirects the browser to Xero's authorize page with an HMAC-signed state
// (stateless CSRF — verified in the callback).
export default defineEventHandler(async (event) => {
  const org = getQuery(event).org as string | undefined
  if (!org) throw createError({ statusCode: 400, message: 'Missing org' })
  if (!xeroConfigured()) throw createError({ statusCode: 501, message: 'Xero is not configured (XERO_CLIENT_ID / XERO_CLIENT_SECRET missing)' })

  const redirectUri = process.env.XERO_REDIRECT_URI || `${getRequestURL(event).origin}/api/xero/callback`
  return sendRedirect(event, xeroAuthorizeUrl(signXeroState(org), redirectUri))
})
