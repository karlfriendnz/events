// Scoped (per-resource) roles — the "next level" of permissions: a role a person
// holds ON a specific resource instance (this group, this event), conferring
// capabilities scoped to that resource. A person can hold MULTIPLE roles on one
// resource (coach + player + captain of the same group); capabilities are the
// UNION across their roles.
//
// Storage reuses the participation rows:
//   • groups → member_group_memberships.roles[] (+ singular role anchor = roles[0])
//   • events → invitees.roles[]
// This composable is the reusable layer: a code registry of roles+capabilities
// per resource type, plus a resolver that gates actions for the current user.
//
// Gating sits ON TOP of the org-wide RBAC (useCan). Rule (prototype-safe):
//   • super_admin                         → manage everything
//   • user IN a permission group          → org-wide can(...,'update') OR scoped manage role
//   • user with ≥1 scoped role (no group) → scoped only (manages just where granted)
//   • user with no group AND no scoped role → unrestricted (nobody is locked out)

// Capabilities are now an org-buildable, per-resource catalogue: "what can this
// person do in this group / event". Stored as a string[] of capability keys, so
// the type is open (a club can't add brand-new keys without code, but the SET it
// ticks per role is entirely theirs). The legacy keys 'view'/'manage'/
// 'take_attendance' still resolve so old data keeps working.
export type ScopedCapability = string
export type ScopedResourceType = 'group' | 'event'

export interface ScopedCapabilityDef {
  key: string
  label: string
  hint: string
  /** A "running it" capability — any of these makes the role MANAGE the resource (gates + staff/roster). */
  manageTier?: boolean
}

// The catalogue of capabilities a role can be granted, per resource type. This
// is the matrix shown on Settings → Roles. Edit here to add/relabel a capability.
export const SCOPED_CAPABILITIES: Record<ScopedResourceType, ScopedCapabilityDef[]> = {
  group: [
    { key: 'view',            label: 'View the group',             hint: 'See the group and who belongs to it' },
    { key: 'view_contacts',   label: 'View contact details',       hint: 'See members’ phone numbers and email addresses' },
    { key: 'manage_members',  label: 'Add & remove members',       hint: 'Add people to the group or take them out', manageTier: true },
    { key: 'communicate',     label: 'Communicate with the group', hint: 'Send messages and emails to its members' },
    { key: 'take_attendance', label: 'Take attendance',            hint: 'Mark the roll for the group’s sessions' },
    { key: 'manage_schedule', label: 'Manage training times',      hint: 'Create and edit the group’s training events', manageTier: true },
    { key: 'edit_details',    label: 'Edit group details',         hint: 'Change the group’s name, description and settings', manageTier: true },
  ],
  event: [
    { key: 'view',            label: 'View the event',             hint: 'See the event and its registrations' },
    { key: 'view_contacts',   label: 'View contact details',       hint: 'See attendees’ phone numbers and email addresses' },
    { key: 'manage_invitees', label: 'Add & remove people',        hint: 'Invite people to the event or remove them', manageTier: true },
    { key: 'communicate',     label: 'Communicate with attendees', hint: 'Send messages and emails to attendees' },
    { key: 'take_attendance', label: 'Take attendance',            hint: 'Check people in on the day' },
    { key: 'edit_details',    label: 'Edit event details',         hint: 'Change the event’s details and settings', manageTier: true },
  ],
}

/** The capability keys that count as "running" a resource (confer manage + staff/roster). */
export function manageTierKeys(type: ScopedResourceType): Set<string> {
  const s = new Set(SCOPED_CAPABILITIES[type].filter(c => c.manageTier).map(c => c.key))
  s.add('manage') // legacy umbrella key
  return s
}
/** A role "runs" the resource (staff, for roster + gates) if it holds any manage-tier capability. */
export function roleRuns(type: ScopedResourceType, capabilities: string[]): boolean {
  const m = manageTierKeys(type)
  return (capabilities ?? []).some(c => m.has(c))
}

export interface ScopedRoleDef {
  key: string
  label: string
  /** Roster grouping — derived from capabilities ('staff' = runs it). Kept for isStaff + the COACHES/MANAGERS split. */
  group: 'member' | 'staff'
  capabilities: ScopedCapability[]
}

// The DEFAULT vocabulary (code registry). Used as the fallback when an org has
// no rows in scoped_role_defs, and as the seed the settings page writes on first
// edit. Once an org has saved its own catalogue, the resolved defs come from the
// DB (migration 184) — see loadRoleDefs() / roleDefs below.
export const SCOPED_ROLES: Record<ScopedResourceType, ScopedRoleDef[]> = {
  group: [
    { key: 'member',          label: 'Member',          group: 'member', capabilities: ['view'] },
    { key: 'player',          label: 'Player',          group: 'member', capabilities: ['view'] },
    { key: 'captain',         label: 'Captain',         group: 'member', capabilities: ['view', 'communicate'] },
    { key: 'assistant_coach', label: 'Assistant Coach', group: 'staff',  capabilities: ['view', 'communicate', 'take_attendance'] },
    { key: 'coach',           label: 'Coach',           group: 'staff',  capabilities: ['view', 'view_contacts', 'manage_members', 'communicate', 'take_attendance', 'manage_schedule', 'edit_details'] },
    { key: 'manager',         label: 'Manager',         group: 'staff',  capabilities: ['view', 'view_contacts', 'manage_members', 'communicate', 'take_attendance', 'manage_schedule', 'edit_details'] },
  ],
  event: [
    { key: 'attendee', label: 'Attendee', group: 'member', capabilities: ['view'] },
    { key: 'coach',    label: 'Coach',    group: 'staff',  capabilities: ['view', 'view_contacts', 'manage_invitees', 'communicate', 'take_attendance', 'edit_details'] },
    { key: 'manager',  label: 'Manager',  group: 'staff',  capabilities: ['view', 'view_contacts', 'manage_invitees', 'communicate', 'take_attendance', 'edit_details'] },
  ],
}

export function useScopedRoles() {
  const db = useDb()
  const { orgId } = useOrg()
  const user = useSupabaseUser()
  const { can, load: loadCan, unrestricted, loaded: canLoaded } = useCan()

  // Resolved once per (user, org): the current user's roles on every group/event.
  const groupRoles = useState<Record<string, string[]>>('fm_scoped_group_roles', () => ({}))
  const eventRoles = useState<Record<string, string[]>>('fm_scoped_event_roles', () => ({}))
  const personId = useState<string | null>('fm_scoped_person_id', () => null)
  const loaded = useState<boolean>('fm_scoped_loaded', () => false)

  // The resolved role catalogue — starts as the code defaults, overridden per
  // resource type by the org's saved scoped_role_defs once loadRoleDefs() runs.
  const roleDefs = useState<Record<ScopedResourceType, ScopedRoleDef[]>>(
    'fm_scoped_role_defs',
    () => ({ group: [...SCOPED_ROLES.group], event: [...SCOPED_ROLES.event] }),
  )
  const roleDefsLoaded = useState<boolean>('fm_scoped_role_defs_loaded', () => false)
  function rolesFor(type: ScopedResourceType): ScopedRoleDef[] { return roleDefs.value[type] ?? [] }

  /** Load this org's saved role catalogue from scoped_role_defs (code defaults stay as fallback per type). */
  async function loadRoleDefs(force = false) {
    if (roleDefsLoaded.value && !force) return
    if (!orgId.value) return
    const { data } = await (db.from as any)('scoped_role_defs')
      .select('resource_type, key, label, role_group, capabilities, sort_order')
      .eq('org_id', orgId.value).order('sort_order')
    const next: Record<ScopedResourceType, ScopedRoleDef[]> = {
      group: [...SCOPED_ROLES.group], event: [...SCOPED_ROLES.event],
    }
    const byType: Record<string, ScopedRoleDef[]> = { group: [], event: [] }
    for (const r of data ?? []) {
      const caps = r.capabilities ?? []
      // role_group is derived from capabilities; trust caps over a stale stored value.
      ;(byType[r.resource_type] ??= []).push({
        key: r.key, label: r.label,
        group: roleRuns(r.resource_type, caps) ? 'staff' : 'member',
        capabilities: caps,
      })
    }
    // Only override a resource type the org has actually customised.
    if (byType.group.length) next.group = byType.group
    if (byType.event.length) next.event = byType.event
    roleDefs.value = next
    roleDefsLoaded.value = true
  }

  // ── Registry helpers ──
  function roleDef(type: ScopedResourceType, key: string): ScopedRoleDef | undefined {
    const k = (key || '').toLowerCase()
    return rolesFor(type).find(r => r.key === k)
  }
  /** Coerce a legacy/free-text role string to a known role key (case-insensitive, label OR key). */
  function normalizeRole(type: ScopedResourceType, raw: string | null | undefined): string | null {
    if (!raw) return null
    const s = String(raw).trim().toLowerCase()
    if (!s) return null
    const byKey = rolesFor(type).find(r => r.key === s)
    if (byKey) return byKey.key
    const byLabel = rolesFor(type).find(r => r.label.toLowerCase() === s)
    if (byLabel) return byLabel.key
    // Legacy substring fallback (old data stored e.g. "Head Coach").
    const byContains = rolesFor(type).find(r => s.includes(r.key))
    return byContains?.key ?? null
  }
  /** Normalise a stored roles array (+ legacy singular) into known keys; defaults to the base member role. */
  function normalizeRoles(type: ScopedResourceType, roles: any, legacy?: string | null): string[] {
    const arr: string[] = Array.isArray(roles) ? roles : []
    const keys = arr.map(r => normalizeRole(type, r)).filter(Boolean) as string[]
    if (!keys.length && legacy) { const k = normalizeRole(type, legacy); if (k) keys.push(k) }
    return [...new Set(keys)]
  }
  function capsFor(type: ScopedResourceType, roleKeys: string[]): Set<ScopedCapability> {
    const out = new Set<ScopedCapability>()
    for (const k of roleKeys) for (const c of (roleDef(type, k)?.capabilities ?? [])) out.add(c)
    return out
  }
  function rolesHaveCap(type: ScopedResourceType, roleKeys: string[], cap: ScopedCapability): boolean {
    // 'manage' is the umbrella gate — satisfied by ANY manage-tier capability
    // (add/remove people, edit details, manage schedule) or the legacy 'manage'.
    if (cap === 'manage') {
      const m = manageTierKeys(type)
      for (const c of capsFor(type, roleKeys)) if (m.has(c)) return true
      return false
    }
    return capsFor(type, roleKeys).has(cap)
  }
  /** Does this set of roles include any 'staff' role (runs the resource)? */
  function isStaff(type: ScopedResourceType, roleKeys: string[]): boolean {
    return roleKeys.some(k => roleDef(type, k)?.group === 'staff')
  }

  const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')
  const hasAnyScopedRole = computed(() =>
    Object.values(groupRoles.value).some(r => r.length) || Object.values(eventRoles.value).some(r => r.length))

  async function load() {
    loaded.value = false
    if (!canLoaded.value) await loadCan()
    const email = user.value?.email
    if (isSuper.value || !email || !orgId.value) {
      groupRoles.value = {}; eventRoles.value = {}; personId.value = null; loaded.value = true; return
    }
    const { data: person } = await (db.from as any)('persons')
      .select('id').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
    personId.value = person?.id ?? null
    if (!person) { groupRoles.value = {}; eventRoles.value = {}; loaded.value = true; return }

    const [{ data: gms }, { data: invs }] = await Promise.all([
      (db.from as any)('member_group_memberships').select('group_id, roles, role').eq('person_id', person.id),
      (db.from as any)('invitees').select('event_id, roles, role').eq('person_id', person.id),
    ])
    const g: Record<string, string[]> = {}
    for (const m of gms ?? []) g[m.group_id] = normalizeRoles('group', m.roles, m.role)
    groupRoles.value = g
    const e: Record<string, string[]> = {}
    for (const i of invs ?? []) e[i.event_id] = normalizeRoles('event', i.roles, i.role)
    eventRoles.value = e
    loaded.value = true
  }

  function rolesOnGroup(groupId: string): string[] { return groupRoles.value[groupId] ?? [] }
  function rolesOnEvent(eventId: string): string[] { return eventRoles.value[eventId] ?? [] }

  // ── Gates ──
  // Manage = the umbrella capability for running a resource (edit it, manage its
  // participants, create its sub-objects).
  function canManageGroup(groupId: string): boolean {
    if (isSuper.value) return true
    const scoped = rolesHaveCap('group', rolesOnGroup(groupId), 'manage')
    if (!unrestricted.value) return can('groups', 'update') || scoped // restricted (in a perm group)
    if (hasAnyScopedRole.value) return scoped                          // scoped-only user
    return true                                                        // truly unmapped → prototype-safe
  }
  function canManageEvent(eventId: string, linkedGroupId?: string | null): boolean {
    if (isSuper.value) return true
    const scoped = rolesHaveCap('event', rolesOnEvent(eventId), 'manage')
      || (!!linkedGroupId && rolesHaveCap('group', rolesOnGroup(linkedGroupId), 'manage'))
    if (!unrestricted.value) return can('events', 'update') || scoped
    if (hasAnyScopedRole.value) return scoped
    return true
  }
  function canTakeAttendanceGroup(groupId: string): boolean {
    if (canManageGroup(groupId)) return true
    return rolesHaveCap('group', rolesOnGroup(groupId), 'take_attendance')
  }
  function canTakeAttendanceEvent(eventId: string, linkedGroupId?: string | null): boolean {
    if (canManageEvent(eventId, linkedGroupId)) return true
    return rolesHaveCap('event', rolesOnEvent(eventId), 'take_attendance')
      || (!!linkedGroupId && rolesHaveCap('group', rolesOnGroup(linkedGroupId), 'take_attendance'))
  }

  const groupsIManage = computed(() => Object.keys(groupRoles.value).filter(id => rolesHaveCap('group', groupRoles.value[id], 'manage')))
  const eventsIManage = computed(() => Object.keys(eventRoles.value).filter(id => rolesHaveCap('event', eventRoles.value[id], 'manage')))

  return {
    SCOPED_ROLES, roleDefs, rolesFor, loadRoleDefs, roleDefsLoaded,
    roleDef, normalizeRole, normalizeRoles, capsFor, rolesHaveCap, isStaff,
    load, loaded, personId, rolesOnGroup, rolesOnEvent,
    canManageGroup, canManageEvent, canTakeAttendanceGroup, canTakeAttendanceEvent,
    groupsIManage, eventsIManage,
  }
}
