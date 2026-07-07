// Auto-launch onboarding for a BRAND-NEW club (migration 247). Only a genuinely
// empty org (no seasons AND no classes) with unfinished onboarding is sent to
// /onboarding — so existing clubs are never trapped. The core steps (club +
// season) can't be skipped; once a season exists the gate releases. Super
// admins, public/embed routes, /admin and the wizard itself are exempt. Fails
// open on any error (never lock a user out).
export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return
  if (to.path === '/onboarding') return
  if (isPublicPath(to.path)) return
  if (to.path.startsWith('/admin')) return

  try {
    const user = useSupabaseUser()
    if (!user.value) return
    if (((user.value as any)?.app_metadata?.role) === 'super_admin') return

    const { orgId } = useOrg()
    if (!orgId.value) return

    const db = useDb()
    const ob = useOnboarding()
    const state = await ob.load()
    if (ob.coreDone(state) || state.completed_at) return // already set up

    // Is this a genuinely new, empty org? (no seasons AND no classes) — only
    // then do we force setup. Established clubs are left alone.
    const [{ count: termCount }, { count: groupCount }] = await Promise.all([
      (db.from as any)('org_terms').select('id', { count: 'exact', head: true }).eq('org_id', orgId.value),
      (db.from as any)('member_groups').select('id', { count: 'exact', head: true }).eq('org_id', orgId.value),
    ])
    if ((termCount ?? 0) === 0 && (groupCount ?? 0) === 0) {
      return navigateTo('/onboarding')
    }
  } catch { /* fail open */ }
})
