// Resolves the platform BRAND NAME the club is connected to (organisations.brand_id
// → brands.name). Used for brand-white-labelled labels like "{Brand} Invoices".
// Cached per org in shared state; falls back to "Frello" when no brand is set.
export function useBrandName() {
  const db = useDb()
  const { orgId } = useOrg()
  const brandName = useState<string>('fm-brand-name', () => 'Frello')
  const loadedFor = useState<string | null>('fm-brand-name-org', () => null)

  async function loadBrandName(force = false) {
    if (!orgId.value) return brandName.value
    if (!force && loadedFor.value === orgId.value) return brandName.value
    loadedFor.value = orgId.value
    const { data: org } = await (db.from as any)('organisations').select('brand_id').eq('id', orgId.value).maybeSingle()
    if (org?.brand_id) {
      const { data: brand } = await (db.from as any)('brands').select('name').eq('id', org.brand_id).maybeSingle()
      brandName.value = brand?.name?.trim() || 'Frello'
    } else brandName.value = 'Frello'
    return brandName.value
  }

  return { brandName, loadBrandName }
}
