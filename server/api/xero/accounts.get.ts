// Live pick-lists for the Settings → Xero mapping UI:
// /api/xero/accounts?org=<orgId> → { revenueAccounts, bankAccounts, taxRates, tracking }
// Filters mirror the legacy FM config screen: revenue-ish accounts for income
// mapping, BANK accounts for payments, revenue-applicable ACTIVE tax rates.
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const org = getQuery(event).org as string | undefined
  if (!org) throw createError({ statusCode: 400, message: 'Missing org' })

  const supabase = createClient(supabaseUrl()!, serviceKey()!)
  const { data: conn } = await supabase.from('xero_connections')
    .select('*').eq('org_id', org).maybeSingle()
  if (!conn) throw createError({ statusCode: 404, message: 'Not connected to Xero' })

  const token = await getValidAccessToken(supabase, conn)
  if (!token) throw createError({ statusCode: 409, message: 'Xero connection lost — please reconnect' })

  try {
    const [accounts, taxRates, tracking] = await Promise.all([
      xeroGet<any>(token, conn.tenant_id, '/Accounts'),
      xeroGet<any>(token, conn.tenant_id, '/TaxRates'),
      xeroGet<any>(token, conn.tenant_id, '/TrackingCategories'),
    ])

    const all = accounts?.Accounts ?? []
    const active = all.filter((a: any) => a.Status === 'ACTIVE')
    return {
      revenueAccounts: active
        .filter((a: any) => a.Class === 'REVENUE' || ['SALES', 'OTHERINCOME'].includes(a.Type))
        .map((a: any) => ({ code: a.Code, name: a.Name, type: a.Type })),
      bankAccounts: active
        .filter((a: any) => a.Type === 'BANK')
        .map((a: any) => ({ code: a.Code, name: a.Name })),
      taxRates: (taxRates?.TaxRates ?? [])
        .filter((t: any) => t.Status === 'ACTIVE' && t.CanApplyToRevenue !== false)
        .map((t: any) => ({ taxType: t.TaxType, name: t.Name, rate: t.EffectiveRate ?? t.DisplayTaxRate })),
      tracking: (tracking?.TrackingCategories ?? [])
        .filter((c: any) => c.Status === 'ACTIVE')
        .map((c: any) => ({
          name: c.Name,
          options: (c.Options ?? []).filter((o: any) => o.Status === 'ACTIVE').map((o: any) => o.Name),
        })),
    }
  } catch (e: any) {
    // 401 → getValidAccessToken already tried; 403 → access revoked in Xero.
    if (e?.statusCode === 403 || e?.status === 403) {
      await supabase.from('xero_connections').update({ status: 'offline' }).eq('id', conn.id)
      throw createError({ statusCode: 409, message: 'Xero access was revoked — please reconnect' })
    }
    console.error('[xero] accounts fetch failed', e)
    throw createError({ statusCode: 502, message: 'Could not load accounts from Xero' })
  }
})
