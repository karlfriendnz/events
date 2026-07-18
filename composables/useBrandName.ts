// Resolves the platform BRAND NAME the club is connected to (organisations.brand_id
// → brands.name). Used for brand-white-labelled labels like "{Brand} Invoices".
// Cached per org in shared state; falls back to "Frello" when no brand is set.
export function useBrandName() {
  const { orgId } = useOrg()
  const { getBrandTheme } = useOrganisationsApi()
  const brandName = useState<string>('fm-brand-name', () => 'Frello')
  const loadedFor = useState<string | null>('fm-brand-name-org', () => null)

  async function loadBrandName(force = false) {
    if (!orgId.value) return brandName.value
    if (!force && loadedFor.value === orgId.value) return brandName.value
    loadedFor.value = orgId.value
    // The brand theme carries the connected brand's name (via brand_id → brands.name).
    try {
      const theme = await getBrandTheme(orgId.value)
      brandName.value = theme?.brandName || 'Frello'
    } catch { brandName.value = 'Frello' }
    return brandName.value
  }

  return { brandName, loadBrandName }
}
