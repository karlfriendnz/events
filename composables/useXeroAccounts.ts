/**
 * Client-side view of the club's Xero account catalogue, for account-code
 * lookups anywhere a fee line captures a GL/account code.
 *
 * Two tiers (PupManager shortlist pattern):
 *  - `shortlist` — the club's curated "Accounts you use" list, loaded DB-only
 *    from xero_connections.fee_accounts (cheap, no Xero API call).
 *  - `allAccounts` — the full revenue chart, lazy-loaded ONCE per session via
 *    /api/xero/accounts the first time a picker is opened.
 *
 * `connected` is false when the org has no online Xero connection — consumers
 * (<XeroAccountInput>) then fall back to a plain free-text input.
 */
export interface XeroShortlistEntry { label: string; code: string; default?: boolean; tracking?: Record<string, string> | null }
export interface XeroAccountRef { code: string; name: string }
export interface XeroTrackingCategory { name: string; options: string[] }

/**
 * LEGACY-COMPATIBLE stored account value (mirrors old FM's Fee.account /
 * TermFeeItem.account and FMXero::setItemAccount): either a bare account code
 * ("200") or, when Xero tracking categories are attached, a JSON blob
 * '{"code":"200","tracking":{"Location":"Albany"}}' — detected by leading '{'.
 * The future sync phase decodes the same way (AccountCode + Tracking entries).
 */
export function parseXeroAccount(v: string | null | undefined): { code: string; tracking: Record<string, string> | null } {
  if (!v) return { code: '', tracking: null }
  if (v[0] === '{') {
    try {
      const info = JSON.parse(v)
      const tracking = info.tracking && Object.keys(info.tracking).length ? info.tracking : null
      return { code: String(info.code ?? ''), tracking }
    } catch { /* fall through — treat as literal code */ }
  }
  return { code: v, tracking: null }
}

export function encodeXeroAccount(code: string, tracking?: Record<string, string> | null): string {
  const t = tracking ? Object.fromEntries(Object.entries(tracking).filter(([, o]) => !!o)) : null
  if (t && Object.keys(t).length) return JSON.stringify({ code, tracking: t })
  return code
}

export const useXeroAccounts = () => {
  const { orgId } = useOrg()
  const financesApi = useFinancesApi()

  const connected = useState<boolean>('xero-accs-connected', () => false)
  const shortlist = useState<XeroShortlistEntry[]>('xero-accs-shortlist', () => [])
  const defaultCode = useState<string | null>('xero-accs-default', () => null)
  const allAccounts = useState<XeroAccountRef[] | null>('xero-accs-all', () => null)
  const trackingCats = useState<XeroTrackingCategory[]>('xero-accs-tracking', () => [])
  const allLoading = useState<boolean>('xero-accs-all-loading', () => false)
  const loadedFor = useState<string | null>('xero-accs-loaded-for', () => null)

  /** Cheap connection load (status + shortlist) via the seam. Once per org. */
  async function loadXeroAccounts(force = false) {
    if (!orgId.value) return
    if (!force && loadedFor.value === orgId.value) return
    loadedFor.value = orgId.value
    const conn = await financesApi.xeroConnection(orgId.value)
    connected.value = !!conn && conn.status === 'online'
    shortlist.value = Array.isArray(conn?.feeAccounts)
      ? conn.feeAccounts.map((a: any) => ({ label: a.label, code: a.code, default: !!a.default, tracking: a.tracking ?? null }))
      : []
    defaultCode.value = conn?.salesAccountCode ?? null
    if (!connected.value) allAccounts.value = null
  }

  /** Lazy full revenue chart (one live Xero call per session, on first picker open). */
  async function loadAllAccounts() {
    if (!connected.value || allAccounts.value || allLoading.value) return
    allLoading.value = true
    try {
      const res: any = await $fetch('/api/xero/accounts', { query: { org: orgId.value } })
      allAccounts.value = res.revenueAccounts ?? []
      trackingCats.value = res.tracking ?? []
    } catch {
      allAccounts.value = []
    } finally {
      allLoading.value = false
    }
  }

  /** Human label for a stored value ("Term fees · Albany"), for tooltips/chips. */
  function labelFor(value: string | null | undefined): string | null {
    const { code, tracking } = parseXeroAccount(value)
    if (!code) return null
    const trackKey = JSON.stringify(tracking ?? {})
    const s = shortlist.value.find(a => a.code === code && JSON.stringify(a.tracking && Object.keys(a.tracking).length ? a.tracking : {}) === trackKey)
      ?? shortlist.value.find(a => a.code === code)
    const base = s?.label ?? allAccounts.value?.find(x => x.code === code)?.name ?? null
    if (!base) return null
    return tracking ? `${base} · ${Object.values(tracking).join(' · ')}` : base
  }

  return { connected, shortlist, defaultCode, allAccounts, allLoading, trackingCats, loadXeroAccounts, loadAllAccounts, labelFor, parseXeroAccount, encodeXeroAccount }
}
