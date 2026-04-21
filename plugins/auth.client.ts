export default defineNuxtPlugin(async () => {
  const user = useSupabaseUser()
  const db = useSupabaseClient()
  const { orgId, orgReady } = useOrg()

  async function fetchOrg(userId: string) {
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
