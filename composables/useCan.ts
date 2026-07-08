// Permission enforcement. Resolves the current user's effective permissions for
// the active org and exposes can(resource, action).
//
// Access model (People/Entities/Access — migration 185+): permissions are a FACET
// of a person's TYPES. A person's effective access = the UNION of the permission
// grids of every access-granting person type they hold (person_target_types where
// is_access, keyed by persons.person_types[]). Legacy permission_groups grants are
// still unioned in during the transition, so existing group assignments keep
// working. Prototype-safe:
//   * super_admin -> everything.
//   * a user with NO person, or a person with no access-granting type AND no
//     legacy group -> unrestricted (existing accounts are never locked out).
//     Giving someone an access-granting type (or a group) is what scopes them.

export function useCan() {
  const db = useDb()
  const { orgId } = useOrg()
  const user = useSupabaseUser()

  const perms = useState<PermissionMap>('fm_eff_perms', () => ({}))
  const unrestricted = useState<boolean>('fm_perms_unrestricted', () => true)
  const loaded = useState<boolean>('fm_perms_loaded', () => false)
  // Which org the cached perms were resolved for — lets ensureLoaded() skip a
  // reload when nothing changed (keeps navigation fast).
  const loadedOrg = useState<string | null>('fm_perms_loaded_org', () => null)

  function mergeInto(merged: PermissionMap, permissions: any) {
    for (const [res, acts] of Object.entries(permissions || {})) {
      merged[res] = merged[res] || {}
      for (const [a, v] of Object.entries(acts as any)) if (v) (merged[res] as any)[a] = true
    }
  }

  async function load() {
    loaded.value = false
    loadedOrg.value = orgId.value
    const isSuper = ((user.value as any)?.app_metadata?.role) === 'super_admin'
    const email = user.value?.email
    if (isSuper || !email || !orgId.value) { unrestricted.value = true; perms.value = {}; loaded.value = true; return }

    const { data: person } = await (db.from as any)('persons')
      .select('id, person_types, person_type').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
    if (!person) { unrestricted.value = true; loaded.value = true; return }

    const merged: PermissionMap = {}
    let scoped = false

    // Union of EVERY person type's permission grid — member types (Parent,
    // Emergency contact…) are configurable too, so their grid drives their menu
    // and access (scoped to their own data on the pages; see useAccessLevel for
    // the admin/own distinction). is_access is no longer required to have a grid.
    const typeKeys: string[] = Array.isArray(person.person_types) && person.person_types.length
      ? person.person_types
      : (person.person_type ? [person.person_type] : [])
    if (typeKeys.length) {
      const { data: types } = await (db.from as any)('person_target_types')
        .select('key, permissions, is_access').eq('org_id', orgId.value).in('key', typeKeys)
      for (const t of types ?? []) {
        // A person WITH a type is governed by their type(s)' grids — even an empty
        // grid means "minimal menu" (restricted), which is the member default.
        scoped = true
        mergeInto(merged, t.permissions)
      }
    }

    // LEGACY model — permission_groups the person is assigned to (transition).
    const { data: mem } = await (db.from as any)('permission_group_members').select('group_id').eq('person_id', person.id)
    const gids = (mem ?? []).map((m: any) => m.group_id)
    if (gids.length) {
      const { data: groups } = await (db.from as any)('permission_groups').select('permissions').in('id', gids)
      for (const g of groups ?? []) { scoped = true; mergeInto(merged, g.permissions) }
    }

    if (!scoped) { unrestricted.value = true; perms.value = {}; loaded.value = true; return }
    perms.value = merged
    unrestricted.value = false
    loaded.value = true
  }

  // Resolve perms once per org and cache them. Callers that need a decision
  // right now (route middleware, <Can>) await this instead of racing load().
  async function ensureLoaded() {
    if (loaded.value && loadedOrg.value === orgId.value) return
    await load()
    loadedOrg.value = orgId.value
  }

  function can(resource: string, action: PermAction = 'read'): boolean {
    if (unrestricted.value) return true
    return !!perms.value?.[resource]?.[action]
  }

  return { can, load, ensureLoaded, loaded, unrestricted, perms }
}
