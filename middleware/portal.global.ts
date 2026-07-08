// Members use the self-service portal (/me); the admin dashboard (/dashboard) is
// for people who manage others. A member (useAccessLevel.isAdmin === false) who
// lands on the admin dashboard — via login routing, the nav "Dashboard" link, or
// a direct URL — is sent to their portal instead. Admins + super-admins pass
// through. Runs after auth.global + org.global (alphabetical), so the user and
// active org are resolved by the time this decides. Fails OPEN on any error so a
// resolution hiccup never traps someone on a blank page.
export default defineNuxtRouteMiddleware(async (to) => {
  try {
    // Only guard the admin dashboard + the bare index that forwards to it.
    if (to.path !== '/dashboard' && to.path !== '/') return

    const user = useSupabaseUser()
    if (!user.value) return // auth.global owns the login redirect

    // Super-admins always get the full app.
    if (((user.value as any)?.app_metadata?.role) === 'super_admin') return

    const { isAdmin, resolveAccessLevel } = useAccessLevel()
    await resolveAccessLevel()
    if (!isAdmin.value) return navigateTo('/me')
  } catch {
    // Fail open — never trap a user on an error.
    return
  }
})
