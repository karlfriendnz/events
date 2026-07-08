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

  // A person can belong to several clubs. Their accessible orgs come from
  // org_members (staff/admin links) AND from persons rows matching their email
  // (members — a parent/gymnast is a persons row, NOT an org_members row).
  // Honour their saved choice if it's one of those, else fall back to the first.
  const email = user.value?.email
  const [{ data: mem }, { data: ppl }] = await Promise.all([
    db.from('org_members').select('org_id').eq('user_id', userId),
    email ? (db.from('persons') as any).select('org_id').ilike('email', email) : Promise.resolve({ data: [] }),
  ])
  const ids = [...new Set([...(mem ?? []).map((r: any) => r.org_id), ...((ppl ?? []) as any[]).map((r: any) => r.org_id)])].filter(Boolean)
  const saved = readActiveOrg()
  orgId.value = (saved && ids.includes(saved)) ? saved : (ids[0] ?? null)
  if (orgId.value) rememberResolvedOrg(orgId.value)
  orgReady.value = true
})
