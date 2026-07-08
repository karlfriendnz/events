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
    // A person can belong to several clubs. Their accessible orgs come from
    // org_members (staff/admin) AND persons rows matching their email (members —
    // a parent/gymnast is a persons row, NOT an org_members row). Honour their
    // saved choice if it's one of those, else the first. Mirrors org.global.ts +
    // login.vue prefetchOrg — all three MUST agree or a member's org flips to null.
    const email = user.value?.email
    const [{ data: mem }, { data: ppl }] = await Promise.all([
      db.from('org_members').select('org_id').eq('user_id', userId),
      email ? (db.from('persons') as any).select('org_id').ilike('email', email) : Promise.resolve({ data: [] }),
    ])
    const ids = [...new Set([...(mem ?? []).map((r: any) => r.org_id), ...(((ppl ?? []) as any[]).map((r: any) => r.org_id))])].filter(Boolean)
    const saved = readActiveOrg()
    orgId.value = (saved && ids.includes(saved)) ? saved : (ids[0] ?? null)
    if (orgId.value) rememberResolvedOrg(orgId.value)
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
