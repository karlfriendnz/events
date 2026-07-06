// Convenience layer over useTerminology for CONSUMING terminology in pages and
// components (the editor at /settings/terminology uses useTerminology directly).
//
// Resolution is per-org (org + NSO ancestors + the club's PRIMARY sport — see
// migration 233) and cached in shared state, so any number of components can
// call ensureTerms() without extra queries. `t()` is reactive: it reads the
// shared map ref, so labels update when the map loads or the org switches.
//
//   const { ensureTerms, t } = useTerms()
//   onMounted(ensureTerms)                       // or in the page's load()
//   {{ t('member', true) }}                      // "Members" / "Swimmers"
//   {{ t('group', true, true) }}                 // lower-case: "classes"
//
// STANDING RULE: never hardcode Member/Group/Code/Term/Coach/Event/Venue/… in
// user-visible strings — always resolve through this.
export function useTerms() {
  const { orgId } = useOrg()
  const terminology = useTerminology()
  const map = useState<Record<string, { singular?: string; plural?: string }>>('fm-terms-map', () => ({}))
  const loadedFor = useState<string | null>('fm-terms-org', () => null)

  async function ensureTerms(force = false) {
    if (!orgId.value) return
    if (!force && loadedFor.value === orgId.value) return
    loadedFor.value = orgId.value
    map.value = await terminology.resolveTerminology(orgId.value)
  }

  /** Resolved label for a term key. `plural` for the plural form, `lower` for lower-case. */
  function t(key: string, plural = false, lower = false): string {
    const v = terminology.term(map.value, key, plural)
    return lower ? v.toLowerCase() : v
  }

  return { ensureTerms, t, map }
}
