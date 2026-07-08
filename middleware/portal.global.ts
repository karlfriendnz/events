// PORTAL confinement. "People" (members who only manage themselves + their
// connections) live in the self-service portal (/me). They must not reach the
// management app. A logged-in non-admin hitting a management route is redirected
// to /me. "Admin" (any access-granting type OR staff role — see useAccessLevel)
// roams freely. Fails open on any error (never trap a user).
const PORTAL_PREFIXES = ['/me', '/account', '/book', '/r/', '/login', '/logout']

function isPortalRoute(path: string) {
  return path === '/me' || PORTAL_PREFIXES.some(p => path === p || path.startsWith(p))
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!import.meta.client) return
  if (isPublicPath(to.path)) return
  if (isPortalRoute(to.path)) return
  if (to.path.startsWith('/admin')) return // super-admin area guards itself

  try {
    const user = useSupabaseUser()
    if (!user.value) return
    if (((user.value as any)?.app_metadata?.role) === 'super_admin') return

    const { isAdmin, resolveAccessLevel } = useAccessLevel()
    await resolveAccessLevel()
    if (!isAdmin.value) return navigateTo('/me')
  } catch { /* fail open */ }
})
