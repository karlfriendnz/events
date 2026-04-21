export function useMenuBookables() {
  const db = useDb()
  const items = useState<any[]>('menuBookables', () => [])

  async function reload() {
    const { data } = await db.from('bookables')
      .select('id, name, main_image, sponsor_image')
      .eq('show_in_menu', true)
      .neq('status', 'DELETED')
      .order('name')
    items.value = data ?? []
  }

  return { items, reload }
}
