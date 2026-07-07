// CUSTOM REPORTS (migration 250) — club-built people reports. A report = a set
// of filters over person fields (core columns, role/type, member position, or a
// custom field) + which columns to show. `runReport` fetches people (+ their
// positions/roles from memberships), derives age from dob, and applies the
// filters in memory (fine for club-scale directories).
export interface ReportFilter { id: string; field: string; op: string; value: any }
export interface ReportConfig { match: 'all' | 'any'; filters: ReportFilter[]; columns: string[] }
export interface CustomReport { id: string; org_id?: string; name: string; config: ReportConfig; sort_order: number }

export const REPORT_OPS = [
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'lt', label: 'less than' },
  { value: 'gt', label: 'more than' },
  { value: 'between', label: 'between' },
  { value: 'includes', label: 'is one of' },
  { value: 'set', label: 'is filled in' },
  { value: 'empty', label: 'is empty' },
]

export function useCustomReports() {
  const db = useDb()
  const { orgId } = useOrg()

  function ageFromDob(dob: string | null): number | null {
    if (!dob) return null
    const d = new Date(dob); if (isNaN(d.getTime())) return null
    // Whole years — no Date.now() in some contexts, but this runs client-side.
    const now = new Date()
    let a = now.getFullYear() - d.getFullYear()
    const m = now.getMonth() - d.getMonth()
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
    return a
  }

  // ── Persistence ──
  async function loadReports(): Promise<CustomReport[]> {
    if (!orgId.value) return []
    const { data } = await (db.from as any)('custom_reports').select('*').eq('org_id', orgId.value).order('sort_order').order('name')
    return (data ?? []).map((r: any) => ({ ...r, config: normalizeConfig(r.config) }))
  }
  async function getReport(id: string): Promise<CustomReport | null> {
    const { data } = await (db.from as any)('custom_reports').select('*').eq('id', id).maybeSingle()
    return data ? { ...data, config: normalizeConfig(data.config) } : null
  }
  async function createReport(name: string, config: ReportConfig): Promise<CustomReport | null> {
    const { data } = await (db.from as any)('custom_reports').insert({ org_id: orgId.value, name: name.trim() || 'Untitled report', config }).select('*').maybeSingle()
    return data ? { ...data, config: normalizeConfig(data.config) } : null
  }
  async function updateReport(id: string, patch: { name?: string; config?: ReportConfig }): Promise<void> {
    await (db.from as any)('custom_reports').update(patch).eq('id', id)
  }
  async function deleteReport(id: string): Promise<void> {
    await (db.from as any)('custom_reports').delete().eq('id', id)
  }
  function normalizeConfig(c: any): ReportConfig {
    return { match: c?.match === 'any' ? 'any' : 'all', filters: Array.isArray(c?.filters) ? c.filters : [], columns: Array.isArray(c?.columns) ? c.columns : ['first_name', 'last_name', 'gender', 'age'] }
  }

  // ── Value resolution for a person + field key ──
  // field keys: core column name | 'age' | 'role' | 'position' | 'cf:<id>'
  function personValue(p: any, field: string): any {
    if (field === 'age') return ageFromDob(p.dob)
    if (field === 'role') return (p.person_types?.length ? p.person_types : [p.person_type]).filter(Boolean)
    if (field === 'position') return p.__positions ?? []
    if (field?.startsWith('cf:')) return p.custom_fields?.[field.slice(3)]
    return p[field]
  }

  function testFilter(p: any, f: ReportFilter): boolean {
    const v = personValue(p, f.field)
    const target = f.value
    switch (f.op) {
      case 'set': return Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim() !== '')
      case 'empty': return Array.isArray(v) ? v.length === 0 : (v == null || String(v).trim() === '')
      case 'eq': return Array.isArray(v) ? v.map(low).includes(low(target)) : low(v) === low(target)
      case 'neq': return Array.isArray(v) ? !v.map(low).includes(low(target)) : low(v) !== low(target)
      case 'contains': return Array.isArray(v) ? v.some((x: any) => low(x).includes(low(target))) : low(v).includes(low(target))
      case 'includes': { const opts = (Array.isArray(target) ? target : String(target).split(',')).map(low); return Array.isArray(v) ? v.some((x: any) => opts.includes(low(x))) : opts.includes(low(v)) }
      case 'lt': return num(v) != null && num(v)! < Number(target)
      case 'gt': return num(v) != null && num(v)! > Number(target)
      case 'between': { const n = num(v); const [a, b] = Array.isArray(target) ? target : [target?.min, target?.max]; return n != null && n >= Number(a) && n <= Number(b) }
      default: return true
    }
  }
  function low(x: any) { return String(x ?? '').trim().toLowerCase() }
  function num(x: any): number | null { const n = Number(x); return isNaN(n) ? null : n }

  /** Run a report config → matching person rows (with derived __positions/__age). */
  async function runReport(config: ReportConfig): Promise<any[]> {
    if (!orgId.value) return []
    const { data: persons } = await (db.from as any)('persons')
      .select('id, first_name, last_name, email, phone, dob, gender, membership_type, person_type, person_types, custom_fields, photo_url')
      .eq('org_id', orgId.value)
    // positions come from member_group_memberships (no org_id there — scope by joined group)
    const needsPositions = config.filters.some(f => f.field === 'position') || config.columns.includes('position')
    const posByPerson: Record<string, string[]> = {}
    if (needsPositions) {
      const { data: mships } = await (db.from as any)('member_group_memberships')
        .select('person_id, positions, group:member_groups!inner(org_id)')
        .eq('group.org_id', orgId.value)
      for (const m of (mships ?? [])) {
        if (!m.person_id || !Array.isArray(m.positions)) continue
        ;(posByPerson[m.person_id] ??= [])
        for (const pos of m.positions) if (pos && !posByPerson[m.person_id].includes(pos)) posByPerson[m.person_id].push(pos)
      }
    }
    const rows = (persons ?? []).map((p: any) => ({ ...p, __positions: posByPerson[p.id] ?? [], __age: ageFromDob(p.dob) }))
    const filters = config.filters.filter(f => f.field && f.op)
    if (!filters.length) return rows
    return rows.filter((p: any) => config.match === 'any' ? filters.some(f => testFilter(p, f)) : filters.every(f => testFilter(p, f)))
  }

  return { REPORT_OPS, ageFromDob, personValue, loadReports, getReport, createReport, updateReport, deleteReport, runReport, normalizeConfig }
}
