export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const user = useSupabaseUser()
  if (!user.value?.id) return

  const { orgId, orgReady } = useOrg()
  if (orgReady.value) return

  const userId = user.value?.id
  if (!userId) return

  const db = useSupabaseClient()

  // Super-admins can view any org (not bound to one org_members row).
  const isSuper = ((user.value as any)?.app_metadata?.role) === 'super_admin'
  if (isSuper) {
    const saved = readActiveOrg()
    if (saved) {
      orgId.value = saved
      rememberResolvedOrg(saved)
    } else {
      const { data } = await (db.from as any)('organisations')
        .select('id').order('org_level', { ascending: false }).order('name').limit(1)
      orgId.value = data?.[0]?.id ?? null
      if (orgId.value) rememberResolvedOrg(orgId.value)
    }
    orgReady.value = true
    return
  }

  // A person can belong to several clubs; honour their saved choice (from
  // <ProfileMenu>) if it's one of their memberships, else fall back to the first.
  const { data } = await db.from('org_members').select('org_id').eq('user_id', userId)
  const ids = (data ?? []).map((r: any) => r.org_id)
  const saved = readActiveOrg()
  orgId.value = (saved && ids.includes(saved)) ? saved : (ids[0] ?? null)
  if (orgId.value) rememberResolvedOrg(orgId.value)
  orgReady.value = true
})
