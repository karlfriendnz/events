// Field engine — resolves an org's effective field definitions: its own plus
// those inherited from its governing bodies (ancestors). Field definitions are
// first-class (field_definitions table), created separately from any form.

export interface FieldDef {
  id: string
  org_id: string
  label: string
  field_type: string
  is_required: boolean
  options: string[]
  help_text: string | null
  sort_order: number
  rules: any[]
  inherited: boolean
  ownerName: string
  ownerLevel: string
}

export function useOrgFieldPolicy() {
  const db = useDb()
  const { ancestors } = useOrgHierarchy()

  /** Own + inherited (ancestor) field definitions for an org. */
  async function resolveFields(orgId: string): Promise<FieldDef[]> {
    const anc = await ancestors(orgId)
    const ids = [orgId, ...anc.map(a => a.id)]
    const { data } = await (db.from as any)('field_definitions')
      .select('id, org_id, label, field_type, is_required, options, help_text, sort_order, rules, organisations(name, org_level)')
      .in('org_id', ids)
      .order('sort_order')
    return (data ?? []).map((f: any) => ({
      ...f,
      options: Array.isArray(f.options) ? f.options : (f.options ? JSON.parse(f.options) : []),
      rules: Array.isArray(f.rules) ? f.rules : (f.rules ? JSON.parse(f.rules) : []),
      inherited: f.org_id !== orgId,
      ownerName: f.organisations?.name ?? '',
      ownerLevel: f.organisations?.org_level ?? '',
    }))
  }

  return { resolveFields }
}
