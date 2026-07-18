// Nav sidebar bookables — the venues a club pins to its left menu. Reads through the
// bookings seam (never the DB directly): the full bookable list, filtered to pinned,
// non-deleted ones and mapped to the small { id, name, main_image, sponsor_image }
// shape the nav consumers expect (snake_case kept so callers are unchanged).
export function useMenuBookables() {
  const api = useBookingsApi()
  const { orgId } = useOrg()
  const items = useState<any[]>('menuBookables', () => [])

  async function reload() {
    if (!orgId.value) return
    const all = await api.bookables(orgId.value)
    items.value = all
      .filter((b) => b.showInMenu && b.status !== 'DELETED')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => ({ id: b.id, name: b.name, main_image: b.mainImage, sponsor_image: b.sponsorImage }))
  }

  return { items, reload }
}
