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
    const saved = (typeof localStorage !== 'undefined') ? localStorage.getItem('fm_active_org') : null
    if (saved) {
      orgId.value = saved
    } else {
      const { data } = await (db.from as any)('organisations')
        .select('id').order('org_level', { ascending: false }).order('name').limit(1)
      orgId.value = data?.[0]?.id ?? null
    }
    orgReady.value = true
    return
  }

  const { data } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
  orgId.value = data?.org_id ?? null
  orgReady.value = true
})
