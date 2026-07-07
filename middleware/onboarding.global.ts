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

    const ob = useOnboarding()
    const [state, done] = await Promise.all([ob.loadState(), ob.detect()])
    if (state.completed_at || state.dismissed) return // finished/dismissed — leave them be
    if (ob.coreDone(done)) return                       // core set up already

    // A genuinely new club (no season yet) is sent into setup; existing clubs
    // (which have terms/classes) satisfy coreDone above and are never trapped.
    return navigateTo('/onboarding')
  } catch { /* fail open */ }
})
