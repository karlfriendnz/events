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

  function mergeInto(merged: PermissionMap, permissions: any) {
    for (const [res, acts] of Object.entries(permissions || {})) {
      merged[res] = merged[res] || {}
      for (const [a, v] of Object.entries(acts as any)) if (v) (merged[res] as any)[a] = true
    }
  }

  async function load() {
    loaded.value = false
    const isSuper = ((user.value as any)?.app_metadata?.role) === 'super_admin'
    const email = user.value?.email
    if (isSuper || !email || !orgId.value) { unrestricted.value = true; perms.value = {}; loaded.value = true; return }

    const { data: person } = await (db.from as any)('persons')
      .select('id, person_types, person_type').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
    if (!person) { unrestricted.value = true; loaded.value = true; return }

    const merged: PermissionMap = {}
    let scoped = false

    // NEW model — union of the person's access-granting types' permission grids.
    const typeKeys: string[] = Array.isArray(person.person_types) && person.person_types.length
      ? person.person_types
      : (person.person_type ? [person.person_type] : [])
    if (typeKeys.length) {
      const { data: types } = await (db.from as any)('person_target_types')
        .select('key, permissions, is_access').eq('org_id', orgId.value).in('key', typeKeys)
      for (const t of types ?? []) {
        if (!t.is_access) continue
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

  function can(resource: string, action: PermAction = 'read'): boolean {
    if (unrestricted.value) return true
    return !!perms.value?.[resource]?.[action]
  }

  return { can, load, loaded, unrestricted, perms }
}
