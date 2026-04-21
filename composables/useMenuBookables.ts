export function useMenuBookables() {
  const db = useDb()
  const { orgId } = useOrg()
  const items = useState<any[]>('menuBookables', () => [])

  async function reload() {
    if (!orgId.value) return
    const { data } = await db.from('bookables')
      .select('id, name, main_image, sponsor_image')
      .eq('org_id', orgId.value)
      .eq('show_in_menu', true)
      .neq('status', 'DELETED')
      .order('name')
    items.value = data ?? []
  }

  return { items, reload }
}
