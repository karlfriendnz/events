// Builds the catalogue of fields a member profile can show — the core persons
// columns plus the org's custom member fields (field_definitions, target MEMBER,
// own + inherited). Used by <ProfileDashboard> field pickers and value lookup.
//
//   core field   → key = column name,  value read from person[key]
//   custom field → key = field id,      value read from person.custom_fields[key]

export interface PersonFieldDef {
  key: string
  label: string
  source: 'core' | 'custom'
  field_type: string
}

const CORE_FIELDS: PersonFieldDef[] = [
  { key: 'first_name', label: 'First name', source: 'core', field_type: 'text' },
  { key: 'last_name', label: 'Last name', source: 'core', field_type: 'text' },
  { key: 'email', label: 'Email', source: 'core', field_type: 'email' },
  { key: 'phone', label: 'Phone', source: 'core', field_type: 'phone' },
  { key: 'dob', label: 'Date of birth', source: 'core', field_type: 'date' },
  { key: 'gender', label: 'Gender', source: 'core', field_type: 'text' },
  { key: 'membership_type', label: 'Membership type', source: 'core', field_type: 'text' },
]

export function usePersonFields() {
  const { resolveFields, fieldAppliesTo } = useOrgFieldPolicy()

  async function loadFieldCatalogue(orgId: string, typeKey = 'member'): Promise<PersonFieldDef[]> {
    const defs = await resolveFields(orgId)
    const custom = (defs ?? [])
      .filter((f: any) => fieldAppliesTo(f, typeKey))
      .map((f: any) => ({ key: f.id as string, label: f.label as string, source: 'custom' as const, field_type: f.field_type as string }))
    return [...CORE_FIELDS, ...custom]
  }

  return { CORE_FIELDS, loadFieldCatalogue }
}
