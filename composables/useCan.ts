// Permission enforcement. Resolves the current user's effective permissions for
// the active org and exposes can(resource, action).
//
// Prototype-safe model:
//   * super_admin -> everything.
//   * a user mapped to a person (by email) who IS in permission groups -> the
//     union of those groups' grants.
//   * a user with no person / no group assignment -> unrestricted (so existing
//     accounts are never locked out). Assigning someone to a group is what
//     starts scoping them.

export function useCan() {
  const db = useDb()
  const { orgId } = useOrg()
  const user = useSupabaseUser()

  const perms = useState<PermissionMap>('fm_eff_perms', () => ({}))
  const unrestricted = useState<boolean>('fm_perms_unrestricted', () => true)
  const loaded = useState<boolean>('fm_perms_loaded', () => false)

  async function load() {
    loaded.value = false
    const isSuper = ((user.value as any)?.app_metadata?.role) === 'super_admin'
    const email = user.value?.email
    if (isSuper || !email || !orgId.value) { unrestricted.value = true; perms.value = {}; loaded.value = true; return }

    const { data: person } = await (db.from as any)('persons')
      .select('id').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
    if (!person) { unrestricted.value = true; loaded.value = true; return }

    const { data: mem } = await (db.from as any)('permission_group_members').select('group_id').eq('person_id', person.id)
    const gids = (mem ?? []).map((m: any) => m.group_id)
    if (!gids.length) { unrestricted.value = true; loaded.value = true; return }

    const { data: groups } = await (db.from as any)('permission_groups').select('permissions').in('id', gids)
    const merged: PermissionMap = {}
    for (const g of groups ?? []) {
      for (const [res, acts] of Object.entries(g.permissions || {})) {
        merged[res] = merged[res] || {}
        for (const [a, v] of Object.entries(acts as any)) if (v) (merged[res] as any)[a] = true
      }
    }
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
