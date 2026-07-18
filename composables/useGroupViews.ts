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
  const { orgId } = useOrg()
  const api = useGroupsApi()
  const views = useState<GroupView[]>('fm-group-views', () => [])

  function normalizeConfig(c: any): GroupViewConfig {
    return {
      columns: Array.isArray(c?.columns) ? c.columns : DEFAULT_CONFIG.columns,
      codeIds: Array.isArray(c?.codeIds) ? c.codeIds : [],
    }
  }

  // camelCase contract → this composable's snake_case GroupView shape.
  function toSnake(v: any): GroupView {
    return { id: v.id, org_id: v.orgId, name: v.name, config: normalizeConfig(v.config), sort_order: v.sortOrder ?? 0 }
  }

  async function loadViews(): Promise<GroupView[]> {
    if (!orgId.value) return []
    const list = (await api.views(orgId.value)).map(toSnake)
    views.value = list
    return list
  }

  async function getView(id: string): Promise<GroupView | null> {
    try {
      return toSnake(await api.view(id))
    } catch {
      return null
    }
  }

  async function createView(patch: { name: string; config?: Partial<GroupViewConfig>; sort_order?: number }): Promise<GroupView | null> {
    try {
      const created = toSnake(await api.createView({
        orgId: orgId.value,
        name: patch.name.trim(),
        config: { ...DEFAULT_CONFIG, ...patch.config },
        sortOrder: patch.sort_order ?? 0,
      }))
      views.value = [...views.value, created]
      return created
    } catch {
      return null
    }
  }

  async function updateView(id: string, patch: { name?: string; config?: GroupViewConfig; sort_order?: number }): Promise<void> {
    await api.updateView(id, { name: patch.name, config: patch.config, sortOrder: patch.sort_order })
    views.value = views.value.map(v => v.id === id ? { ...v, ...patch } as GroupView : v)
  }

  async function deleteView(id: string): Promise<void> {
    await api.removeView(id)
    views.value = views.value.filter(v => v.id !== id)
  }

  return { views, VIEW_COLUMNS, DEFAULT_CONFIG, loadViews, getView, createView, updateView, deleteView }
}
