// ACCESS LEVEL — the Admin vs Person distinction.
//   ADMIN  = manages OTHER people. Holds an access-granting person type
//            (person_target_types.is_access) OR any STAFF role on a class/event
//            (member_group_memberships.roles / invitees.roles), OR a legacy
//            permission group, OR is super_admin. → the full management app.
//   PERSON = manages only THEMSELVES + their connections (family/circles). A
//            member with no management access. → the self-service portal (/me).
// A login with no matching person in the ACTIVE club gets the least privilege
// (member portal) — real admins have a person record with an access-granting
// type or staff role, and super-admins are exempt. Cross-club login lands you
// in a club where you DO have a record (see useMyClubs / login routing), so this
// only bites truly unrecognised sessions. Cached per org.
export function useAccessLevel() {
  const db = useDb()
  const { orgId } = useOrg()
  const user = useSupabaseUser()
  const scoped = useScopedRoles()

  const isAdmin = useState<boolean>('fm_is_admin', () => true)
  const myPersonId = useState<string | null>('fm_my_person_id', () => null)
  const resolvedOrg = useState<string | null>('fm_access_org', () => null)
  const resolved = useState<boolean>('fm_access_resolved', () => false)

  async function resolveAccessLevel(force = false): Promise<boolean> {
    if (!force && resolved.value && resolvedOrg.value === orgId.value) return isAdmin.value
    resolvedOrg.value = orgId.value
    resolved.value = true

    const isSuper = ((user.value as any)?.app_metadata?.role) === 'super_admin'
    if (isSuper) { isAdmin.value = true; return true }
    const email = user.value?.email
    if (!email || !orgId.value) { isAdmin.value = true; return true } // never lock out

    const { data: person } = await (db.from as any)('persons')
      .select('id, person_types, person_type').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
    if (!person) { isAdmin.value = false; myPersonId.value = null; return false } // not a member of THIS club → least privilege (portal)
    myPersonId.value = person.id

    // 1) Access-granting person type?
    const typeKeys: string[] = Array.isArray(person.person_types) && person.person_types.length
      ? person.person_types : (person.person_type ? [person.person_type] : [])
    if (typeKeys.length) {
      const { data: types } = await (db.from as any)('person_target_types')
        .select('is_access').eq('org_id', orgId.value).in('key', typeKeys)
      if ((types ?? []).some((t: any) => t.is_access)) { isAdmin.value = true; return true }
    }

    // 2) Legacy permission group?
    const { data: pg } = await (db.from as any)('permission_group_members').select('group_id').eq('person_id', person.id).limit(1)
    if ((pg ?? []).length) { isAdmin.value = true; return true }

    // 3) Any STAFF role on a class or event?
    await scoped.loadRoleDefs()
    const { data: gm } = await (db.from as any)('member_group_memberships').select('roles, role').eq('person_id', person.id)
    for (const m of (gm ?? [])) {
      const roles = (m.roles?.length ? m.roles : [m.role]).filter(Boolean)
      if (roles.length && scoped.isStaff('group', roles)) { isAdmin.value = true; return true }
    }
    const { data: iv } = await (db.from as any)('invitees').select('roles, role').eq('person_id', person.id)
    for (const m of (iv ?? [])) {
      const roles = (m.roles?.length ? m.roles : [m.role]).filter(Boolean)
      if (roles.length && scoped.isStaff('event', roles)) { isAdmin.value = true; return true }
    }

    // A member with none of the above → self-service.
    isAdmin.value = false
    return false
  }

  return { isAdmin, myPersonId, resolved, resolveAccessLevel }
}
