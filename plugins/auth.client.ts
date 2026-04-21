export default defineNuxtPlugin(async () => {
  const user = useSupabaseUser()
  const db = useSupabaseClient()
  const { orgId } = useOrg()

  async function fetchOrg(userId: string) {
    const { data } = await db.from('org_members').select('org_id').eq('user_id', userId).single()
    orgId.value = data?.org_id ?? null
  }

  if (user.value?.id) {
    await fetchOrg(user.value.id)
  }

  watch(user, async (u) => {
    if (u) {
      await fetchOrg(u.id)
    } else {
      orgId.value = null
    }
  })
})
