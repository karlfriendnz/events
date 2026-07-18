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
  const { orgId } = useOrg()

  // ageFromDob comes from useAge (THE age helper) — re-exported below so this
  // composable's API is unchanged. NB it now clamps to 0..130, so a typo'd dob
  // reports null instead of a confident 126: lt/gt/between stop matching it and
  // `set` reads as empty. That's a behaviour change to saved reports, and an
  // intended one — 126 was a lie.

  // ── Persistence (via the /api/v1 seam — never useDb) ──
  // The seam returns camelCase (orgId/sortOrder); map back to the snake shape the
  // CustomReport type + consumers expect.
  function mapReport(r: any): CustomReport {
    return { id: r.id, org_id: r.orgId, name: r.name, config: normalizeConfig(r.config), sort_order: r.sortOrder ?? 0 }
  }
  async function loadReports(): Promise<CustomReport[]> {
    if (!orgId.value) return []
    const rows = await $fetch<any[]>('/api/v1/custom-reports', { query: { orgId: orgId.value } })
    return (rows ?? []).map(mapReport)
  }
  async function getReport(id: string): Promise<CustomReport | null> {
    const r = await $fetch<any | null>(`/api/v1/custom-reports/${id}`)
    return r ? mapReport(r) : null
  }
  async function createReport(name: string, config: ReportConfig): Promise<CustomReport | null> {
    const r = await $fetch<any>('/api/v1/custom-reports', {
      method: 'POST',
      query: { orgId: orgId.value },
      body: { name: name.trim() || 'Untitled report', config },
    })
    return r ? mapReport(r) : null
  }
  async function updateReport(id: string, patch: { name?: string; config?: ReportConfig }): Promise<void> {
    await $fetch(`/api/v1/custom-reports/${id}`, { method: 'PATCH', body: patch })
  }
  async function deleteReport(id: string): Promise<void> {
    await $fetch(`/api/v1/custom-reports/${id}`, { method: 'DELETE' })
  }
  /** Distinct member-group positions across the org (report builder field picker). */
  async function loadReportPositions(): Promise<string[]> {
    if (!orgId.value) return []
    return await $fetch<string[]>('/api/v1/custom-reports/positions', { query: { orgId: orgId.value } })
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
    // The seam hands back the snake_case field vocabulary + each person's union of
    // member-group positions (__positions). Derive __age client-side and filter in
    // memory (the pure filter engine is unchanged — fine at club scale).
    const persons = await $fetch<any[]>('/api/v1/custom-reports/people', { query: { orgId: orgId.value } })
    const rows = (persons ?? []).map((p: any) => ({ ...p, __age: ageFromDob(p.dob) }))
    const filters = config.filters.filter(f => f.field && f.op)
    if (!filters.length) return rows
    return rows.filter((p: any) => config.match === 'any' ? filters.some(f => testFilter(p, f)) : filters.every(f => testFilter(p, f)))
  }

  return { REPORT_OPS, ageFromDob, personValue, loadReports, getReport, createReport, updateReport, deleteReport, runReport, loadReportPositions, normalizeConfig }
}
