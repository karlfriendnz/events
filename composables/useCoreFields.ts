// PROTOTYPE — global core fields. Personal details + Communication are the same
// for every person type, so they're defined ONCE at the org level (migration 186)
// rather than per type. Each core field has a REQUIREMENT mode:
//   • always       — always required, locked (First/Last/Role, and DOB+Gender
//                    which we use to match & de-duplicate people)
//   • conditional  — required only when it applies (Email: account holders, or
//                    anyone who receives communications)
//   • configurable — the club chooses Required vs Optional (Phone)
//   • optional     — collected only if the club switches it on (Secondary phone,
//                    Communication preferences)
// Config shape on organisations.core_fields:
//   { required: { phone: true }, enabled: { phone2: false, comms: true } }

export type CoreReq = 'always' | 'conditional' | 'configurable' | 'optional'
export type CoreStatus = 'required' | 'conditional' | 'optional' | 'off'

export interface CoreFieldDef { key: string; label: string; type: string; requirement: CoreReq; note?: string }
export interface CoreConfig { required?: Record<string, boolean>; enabled?: Record<string, boolean> }

export const CORE_SECTIONS: { key: string; label: string; desc: string; fields: CoreFieldDef[] }[] = [
  {
    key: 'personal', label: 'Personal details',
    desc: 'Identity fields every person has. Date of birth and gender are required because we use them to match and de-duplicate people.',
    fields: [
      { key: 'first_name', label: 'First name', type: 'text',  requirement: 'always' },
      { key: 'last_name',  label: 'Last name',  type: 'text',  requirement: 'always' },
      { key: 'role',       label: 'User role',  type: 'roles', requirement: 'always' },
      { key: 'dob',        label: 'Date of birth', type: 'date',  requirement: 'always', note: 'Used to match people' },
      { key: 'gender',     label: 'Gender',     type: 'select', requirement: 'always', note: 'Used to match people' },
    ],
  },
  {
    key: 'communication', label: 'Communication', desc: 'How the club reaches a person.',
    fields: [
      { key: 'email',  label: 'Email', type: 'email', requirement: 'conditional', note: 'Required for account holders, or anyone who receives communications' },
      { key: 'phone',  label: 'Phone', type: 'phone', requirement: 'configurable' },
      { key: 'phone2', label: 'Secondary phone', type: 'phone', requirement: 'optional' },
      { key: 'comms',  label: 'Communication preferences', type: 'comms', requirement: 'optional' },
    ],
  },
]

/** Effective status of a core field given the club's config. */
export function coreStatus(cfg: CoreConfig, f: CoreFieldDef): CoreStatus {
  if (f.requirement === 'always') return 'required'
  if (f.requirement === 'conditional') return 'conditional'
  if (f.requirement === 'configurable') return cfg.required?.[f.key] ? 'required' : 'optional'
  return cfg.enabled?.[f.key] === false ? 'off' : 'optional'  // optional cores default ON
}

/**
 * Validate a person's core fields against the global config.
 * ctx: accountHolder = the person can log in; receivesComms = subscribed to comms.
 * Returns { fieldKey: message } for every unmet requirement.
 */
export function coreErrors(
  cfg: CoreConfig,
  person: any,
  ctx: { accountHolder?: boolean; receivesComms?: boolean } = {},
): Record<string, string> {
  const e: Record<string, string> = {}
  const blank = (v: any) => v === null || v === undefined || (typeof v === 'string' && !v.trim())
  // always required
  if (blank(person.first_name)) e.first_name = 'Required'
  if (blank(person.last_name)) e.last_name = 'Required'
  if (!(Array.isArray(person.person_types) && person.person_types.length)) e.role = 'Pick at least one role'
  if (blank(person.dob)) e.dob = 'Required — we use it to match people'
  if (blank(person.gender)) e.gender = 'Required — we use it to match people'
  // email is conditional
  if ((ctx.accountHolder || ctx.receivesComms) && blank(person.email))
    e.email = ctx.accountHolder ? 'Email is needed to log in' : 'Email is needed to receive communications'
  // phone is required only if the club requires it
  if (cfg.required?.phone && blank(person.phone)) e.phone = 'Required'
  return e
}

export function useCoreFields() {
  const db = useDb()
  const { orgId } = useOrg()

  async function loadConfig(): Promise<CoreConfig> {
    if (!orgId.value) return {}
    const { data } = await (db.from as any)('organisations').select('core_fields').eq('id', orgId.value).maybeSingle()
    const c = data?.core_fields ?? {}
    return { required: c.required ?? {}, enabled: c.enabled ?? {} }
  }
  async function saveConfig(cfg: CoreConfig) {
    if (!orgId.value) return
    await (db.from as any)('organisations').update({ core_fields: cfg }).eq('id', orgId.value)
  }

  return { CORE_SECTIONS, coreStatus, loadConfig, saveConfig }
}
