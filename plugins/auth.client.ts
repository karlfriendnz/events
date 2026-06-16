export default defineNuxtPlugin(async () => {
  const user = useSupabaseUser()
  const db = useSupabaseClient()
  const { orgId, orgReady } = useOrg()

  async function fetchOrg(userId: string) {
    // Super-admins aren't tied to one org via org_members — they can view any
    // organisation. Use their persisted choice (from <OrgSwitcher>), else the
    // top-most org by level.
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
  }

  // Handle initial load when session is already in localStorage
  if (user.value?.id) {
    await fetchOrg(user.value.id)
  }

  // Handle auth state changes (login/logout)
  watch(user, async (u) => {
    if (u?.id) {
      await fetchOrg(u.id)
    } else if (u === null) {
      orgId.value = null
      orgReady.value = false
    }
  })
})
