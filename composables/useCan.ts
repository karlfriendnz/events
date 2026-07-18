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
  // Access reads go through the typed seam: person-by-email (people), the org's own
  // person types with their grids (person-types), and a person's legacy permission
  // groups (roles). No direct DB access.
  const { orgId } = useOrg()
  const user = useSupabaseUser()
  const { findByEmail } = usePeopleApi()
  const { listOrgTypes } = usePersonTypesApi()
  const { permissionGroupsForPerson } = useRolesApi()

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
    // Preview-as-type: resolve THAT type's grid (overrides real access, incl. super).
    const { previewKey } = usePreviewType()
    if (previewKey.value && orgId.value) {
      const pt = (await listOrgTypes(orgId.value)).find((t) => t.key === previewKey.value)
      const m: PermissionMap = {}; mergeInto(m, pt?.permissions); perms.value = m; unrestricted.value = false; loaded.value = true; return
    }
    const isSuper = ((user.value as any)?.app_metadata?.role) === 'super_admin'
    const email = user.value?.email
    if (isSuper || !email) { unrestricted.value = true; perms.value = {}; loaded.value = true; return }
    // Org not resolved yet (fresh-login race): DON'T cache a decision. Default to
    // unrestricted transiently but leave loaded=false so this re-runs once orgId
    // is ready — otherwise a member gets stuck 'unrestricted' (full admin menu).
    if (!orgId.value) { unrestricted.value = true; perms.value = {}; loaded.value = false; loadedOrg.value = null; return }

    const person = await findByEmail(orgId.value, email)
    if (!person) { unrestricted.value = true; loaded.value = true; return }

    const merged: PermissionMap = {}
    let scoped = false

    // Union of EVERY person type's permission grid — member types (Parent,
    // Emergency contact…) are configurable too, so their grid drives their menu
    // and access (scoped to their own data on the pages; see useAccessLevel for
    // the admin/own distinction). is_access is no longer required to have a grid.
    const typeKeys: string[] = person.personTypes.length
      ? person.personTypes
      : (person.personType ? [person.personType] : [])
    if (typeKeys.length) {
      const orgTypes = await listOrgTypes(orgId.value)
      for (const t of orgTypes.filter((t) => typeKeys.includes(t.key))) {
        // A person WITH a type is governed by their type(s)' grids — even an empty
        // grid means "minimal menu" (restricted), which is the member default.
        scoped = true
        mergeInto(merged, t.permissions)
      }
    }

    // LEGACY model — permission_groups the person is assigned to (transition).
    const groups = await permissionGroupsForPerson(person.id)
    for (const g of groups) { scoped = true; mergeInto(merged, g.grants) }

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
