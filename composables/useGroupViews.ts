// Group views (migration 207) — saved, configurable Classes-style overview
// pages. A view = { name, config: { columns, codeIds } }. columns picks which
// of the optional columns show (head/gymnasts/waitlist/sport; Name is always
// on); codeIds picks which top-level codes appear as tabs (empty = all).
// Rendered by <ClassesBoard> at /groups/view/:id, managed at /groups/views,
// and listed in the Groups nav flyout.

export const VIEW_COLUMNS = [
  { key: 'head', label: 'Head' },
  { key: 'gymnasts', label: 'Gymnasts' },
  { key: 'waitlist', label: 'Waitlist' },
  { key: 'attendances', label: 'Attendances' },
  { key: 'termfee', label: 'Term fee' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'signup', label: 'Signup' },
  { key: 'sport', label: 'Sport' },
] as const

export type ViewColumnKey = typeof VIEW_COLUMNS[number]['key']

export interface GroupViewConfig {
  columns: ViewColumnKey[]
  codeIds: string[]
}

export interface GroupView {
  id: string
  org_id?: string
  name: string
  config: GroupViewConfig
  sort_order: number
  created_at?: string
}

const DEFAULT_CONFIG: GroupViewConfig = { columns: ['head', 'gymnasts', 'waitlist', 'attendances', 'termfee', 'gender', 'signup', 'sport'], codeIds: [] }

export function useGroupViews() {
  const db = useDb()
  const { orgId } = useOrg()

  function normalizeConfig(c: any): GroupViewConfig {
    return {
      columns: Array.isArray(c?.columns) ? c.columns : DEFAULT_CONFIG.columns,
      codeIds: Array.isArray(c?.codeIds) ? c.codeIds : [],
    }
  }

  async function loadViews(): Promise<GroupView[]> {
    if (!orgId.value) return []
    const { data } = await (db.from as any)('group_views')
      .select('id, org_id, name, config, sort_order, created_at')
      .eq('org_id', orgId.value)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    return (data ?? []).map((r: any) => ({ ...r, config: normalizeConfig(r.config) }))
  }

  async function getView(id: string): Promise<GroupView | null> {
    const { data } = await (db.from as any)('group_views')
      .select('id, org_id, name, config, sort_order, created_at')
      .eq('id', id)
      .maybeSingle()
    return data ? { ...data, config: normalizeConfig(data.config) } : null
  }

  async function createView(patch: { name: string; config?: Partial<GroupViewConfig>; sort_order?: number }): Promise<GroupView | null> {
    const { data } = await (db.from as any)('group_views').insert({
      org_id: orgId.value,
      name: patch.name.trim(),
      config: { ...DEFAULT_CONFIG, ...patch.config },
      sort_order: patch.sort_order ?? 0,
    }).select('id, org_id, name, config, sort_order, created_at').maybeSingle()
    return data ? { ...data, config: normalizeConfig(data.config) } : null
  }

  async function updateView(id: string, patch: { name?: string; config?: GroupViewConfig; sort_order?: number }): Promise<void> {
    await (db.from as any)('group_views').update(patch).eq('id', id)
  }

  async function deleteView(id: string): Promise<void> {
    await (db.from as any)('group_views').delete().eq('id', id)
  }

  return { VIEW_COLUMNS, DEFAULT_CONFIG, loadViews, getView, createView, updateView, deleteView }
}
