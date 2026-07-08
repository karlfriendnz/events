// Route read-gates. Runs after auth.global + org.global (global middleware run
// alphabetically: auth -> org -> permissions), so the user + orgId are resolved
// by the time we get here.
//
// For a route whose area maps to a PERMISSION_RESOURCES key (see useRouteGate),
// require can(resource, 'read'). Denied -> bounce to /dashboard with a
// ?denied=<resource> marker (middleware can't toast; the dashboard may surface it
// or ignore it). FAILS OPEN on every error/unloaded path — a resolution failure
// must never lock a user out, preserving useCan's never-lock-out fallback.

export default defineNuxtRouteMiddleware(async (to) => {
  try {
    // Public / embed routes are handled by auth.global; never gate them.
    if (isPublicPath(to.path)) return

    const user = useSupabaseUser()
    if (!user.value) return // auth.global owns the login redirect

    // Super admins bypass all gating.
    if (((user.value as any)?.app_metadata?.role) === 'super_admin') return

    const resource = routeResourceForPath(to.path)
    if (!resource) return // ungated route

    // A person can always view their OWN profile, even without People access.
    if (resource === 'people') {
      try {
        const { myPersonId, resolveAccessLevel } = useAccessLevel()
        await resolveAccessLevel()
        if (myPersonId.value && to.path === `/people/${myPersonId.value}`) return
      } catch { /* fall through to normal gate */ }
    }

    const { ensureLoaded, can, unrestricted } = useCan()
    await ensureLoaded()

    // Never-lock-out fallback: user with no access-type + no legacy group.
    if (unrestricted.value) return

    if (can(resource, ROUTE_GATE_ACTION)) return

    // Avoid a redirect loop if somehow /dashboard itself were gated (it isn't).
    if (to.path === '/dashboard') return
    return navigateTo({ path: '/dashboard', query: { denied: resource } })
  } catch {
    // Fail open — resolution errors must not block navigation.
    return
  }
})
