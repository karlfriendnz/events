// Disconnects an org from Xero: best-effort revoke on Xero's side (removes the
// app from the user's connected-apps list), then deletes the local row.
// Mapping columns go with the row; money-row xero ids (when the sync phase
// exists) are intentionally left untouched so a reconnect to the SAME tenant
// resumes cleanly (legacy FM soft-disconnect semantics).
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const { orgId } = await readBody(event) as { orgId?: string }
  if (!orgId) throw createError({ statusCode: 400, message: 'Missing orgId' })

  const supabase = createClient(supabaseUrl()!, serviceKey()!)
  const { data: conn } = await supabase.from('xero_connections')
    .select('*').eq('org_id', orgId).maybeSingle()
  if (!conn) return { ok: true, already: true }

  const token = await getValidAccessToken(supabase, conn)
  if (token) await revokeXeroConnections(token)

  await supabase.from('xero_connections').delete().eq('id', conn.id)
  return { ok: true }
})
