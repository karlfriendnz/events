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
  // The Admin-vs-Person resolver reads cross-domain, all through the typed seam:
  // person-by-email (people), the org's own types + their is_access (person-types),
  // a person's legacy permission groups (roles), their class-membership roles
  // (groups), and their event-invitee roles (events). Guarded: an unresolved session
  // fails to the least privilege (member portal), never locks out.
  const { orgId } = useOrg()
  const user = useSupabaseUser()
  const scoped = useScopedRoles()
  const { findByEmail } = usePeopleApi()
  const { listOrgTypes } = usePersonTypesApi()
  const { permissionGroupsForPerson } = useRolesApi()
  const { membershipsForPerson } = useGroupsApi()
  const { inviteesForPerson } = useEventsApi()

  const isAdmin = useState<boolean>('fm_is_admin', () => true)
  const myPersonId = useState<string | null>('fm_my_person_id', () => null)
  const resolvedOrg = useState<string | null>('fm_access_org', () => null)
  const resolved = useState<boolean>('fm_access_resolved', () => false)

  async function resolveAccessLevel(force = false): Promise<boolean> {
    if (!force && resolved.value && resolvedOrg.value === orgId.value) return isAdmin.value
    resolvedOrg.value = orgId.value
    resolved.value = true

    // Preview-as-type: reflect that type's admin/member status.
    const { previewKey } = usePreviewType()
    if (previewKey.value && orgId.value) {
      const pt = (await listOrgTypes(orgId.value)).find((t) => t.key === previewKey.value)
      isAdmin.value = !!pt?.isAccess; myPersonId.value = null; return isAdmin.value
    }
    const isSuper = ((user.value as any)?.app_metadata?.role) === 'super_admin'
    if (isSuper) { isAdmin.value = true; return true }
    const email = user.value?.email
    if (!email || !orgId.value) { isAdmin.value = true; return true } // never lock out

    const person = await findByEmail(orgId.value, email)
    if (!person) { isAdmin.value = false; myPersonId.value = null; return false } // not a member of THIS club → least privilege (portal)
    myPersonId.value = person.id

    // 1) Access-granting person type?
    const typeKeys: string[] = person.personTypes.length
      ? person.personTypes : (person.personType ? [person.personType] : [])
    if (typeKeys.length) {
      const orgTypes = await listOrgTypes(orgId.value)
      if (orgTypes.some((t) => typeKeys.includes(t.key) && t.isAccess)) { isAdmin.value = true; return true }
    }

    // 2) Legacy permission group?
    if ((await permissionGroupsForPerson(person.id)).length) { isAdmin.value = true; return true }

    // 3) Any STAFF role on a class or event?
    await scoped.loadRoleDefs()
    const gm = await membershipsForPerson(orgId.value, person.id)
    for (const m of gm) {
      const roles = (m.roles?.length ? m.roles : [m.role]).filter(Boolean) as string[]
      if (roles.length && scoped.isStaff('group', roles)) { isAdmin.value = true; return true }
    }
    // Any STAFF role on an event? Guarded: worst case a staff-only-via-event login
    // reads as a member (least privilege), never locked out.
    const iv = await inviteesForPerson(person.id)
    for (const m of iv) {
      const roles = (m.roles?.length ? m.roles : [m.role]).filter(Boolean) as string[]
      if (roles.length && scoped.isStaff('event', roles)) { isAdmin.value = true; return true }
    }

    // A member with none of the above → self-service.
    isAdmin.value = false
    return false
  }

  return { isAdmin, myPersonId, resolved, resolveAccessLevel }
}
