export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const user = useSupabaseUser()
  if (!user.value?.id) return

  const { orgId, orgReady } = useOrg()
  if (orgReady.value) return

  const db = useSupabaseClient()
  const { data } = await db.from('org_members').select('org_id').eq('user_id', user.value.id).single()
  orgId.value = data?.org_id ?? null
  orgReady.value = true
})
