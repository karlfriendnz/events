// Per-tab active org for super-admins. sessionStorage is per-tab, so two tabs
// can view two different clubs at once; localStorage is a "last used" fallback
// that seeds a freshly opened tab (which then switches independently).

const KEY = 'fm_active_org'

export function readActiveOrg(): string | null {
  if (typeof window === 'undefined') return null
  try { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY) } catch { return null }
}

/** Called by the switcher — sets this tab AND the last-used default. */
export function persistActiveOrg(id: string) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(KEY, id); localStorage.setItem(KEY, id) } catch { /* ignore */ }
}

/** Pin the tab to whatever org we resolved (so it sticks across reloads). */
export function rememberResolvedOrg(id: string) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(KEY, id) } catch { /* ignore */ }
}
