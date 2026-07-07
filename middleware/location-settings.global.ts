// Settings is CLUB-WIDE configuration — it only makes sense from the "All
// locations" lens. When the user is scoped to a single location, block every
// /settings* route (and its standalone settings pages) and bounce to the
// dashboard. Reads the active-location lens; falls back to sessionStorage on a
// hard load so a deep-link is caught before the switcher mounts.
const SETTINGS_PREFIXES = ['/settings', '/admin']

export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return
  if (!SETTINGS_PREFIXES.some(p => to.path === p || to.path.startsWith(p + '/'))) return
  // /admin is super-admin cross-org and never lens-scoped — leave it.
  if (to.path.startsWith('/admin')) return

  // Active location: the shared lens state, or (hard load) any per-org
  // sessionStorage key the switcher would restore from.
  let active: string | null = null
  try {
    active = useState<string | null>('fm-active-location').value ?? null
    if (!active) {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)
        if (k && k.startsWith('fm_active_location_') && sessionStorage.getItem(k)) { active = sessionStorage.getItem(k); break }
      }
    }
  } catch { /* no window — allow */ }

  if (active) {
    return navigateTo('/dashboard?settings_needs_all_locations=1')
  }
})
