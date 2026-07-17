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
  // A select field's allowed values. Without these a caller offering a value
  // picker can only show a free-text box — which is how someone types "blue" for
  // a field whose stored option is "Blue" and silently never matches.
  options?: string[]
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

// VIRTUAL — computed from persons.dob at read time, never stored (there is no
// persons.age column and there should not be one, or it would be wrong by the next
// birthday). useCustomReports already does exactly this for its 'age' report
// field. Kept out of CORE_FIELDS so the profile-dashboard pickers, which read
// person[key] directly, don't offer a key that has no column behind it — callers
// that can compute it opt in via `includeAge`.
const AGE_FIELD: PersonFieldDef = { key: 'age', label: 'Age', source: 'core', field_type: 'number' }

export function usePersonFields() {
  const { resolveFields, fieldAppliesTo } = useOrgFieldPolicy()

  /**
   * `typeKey = null` → EVERY field the org has, whatever person type it's for.
   * Callers that scope by person type themselves need this: a governing body's
   * fields often target 'gymnast'/'player' rather than 'member', so filtering the
   * catalogue to 'member' would hand them an empty list.
   */
  async function loadFieldCatalogue(orgId: string, typeKey: string | null = 'member', opts?: { includeAge?: boolean }): Promise<PersonFieldDef[]> {
    const defs = await resolveFields(orgId)
    const custom = (defs ?? [])
      .filter((f: any) => typeKey === null || fieldAppliesTo(f, typeKey))
      .map((f: any) => ({ key: f.id as string, label: f.label as string, source: 'custom' as const, field_type: f.field_type as string, options: Array.isArray(f.options) ? f.options : [] }))
    return [...CORE_FIELDS, ...(opts?.includeAge ? [AGE_FIELD] : []), ...custom]
  }

  return { CORE_FIELDS, AGE_FIELD, loadFieldCatalogue }
}
