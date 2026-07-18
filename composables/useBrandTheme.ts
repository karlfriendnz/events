// Applies the active org's connected brand colour to the platform at runtime by
// overriding the --brand-primary CSS variables on <html>. The Tailwind `primary`
// token + every migrated #1E2157 literal read these vars, so setting them
// re-themes the whole app. When the org has no brand (or no colour), the inline
// overrides are removed so the :root defaults (FriendlyManager navy) take over.

function clampHex(h: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(h.trim())
  return m ? m[1] : null
}
function darken(hex: string, amount = 0.12): string {
  const h = clampHex(hex); if (!h) return hex
  const f = (i: number) => Math.max(0, Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - amount)))
  return `#${[0, 2, 4].map(i => f(i).toString(16).padStart(2, '0')).join('')}`
}
function rgba(hex: string, alpha: number): string {
  const h = clampHex(hex); if (!h) return hex
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// A governing body with no brand of its own reads as a DIFFERENT tier of the
// platform, so its rail is FM's national blue rather than the club navy. A club,
// or an NSO that connected a real brand, is unaffected (the brand still wins).
const GOVERNING_PRIMARY = '#2494D3'

export function useBrandTheme() {
  // Resolves the active org's connected brand colour + level in one seam call.
  const orgsApi = useOrganisationsApi()
  const { orgId } = useOrg()

  function apply(color: string | null) {
    if (typeof document === 'undefined') return
    const root = document.documentElement.style
    if (color && clampHex(color)) {
      root.setProperty('--brand-primary', color)
      root.setProperty('--brand-primary-hover', darken(color))
      root.setProperty('--brand-primary-light', rgba(color, 0.06))
      // The nav-rail gradient's dark end — derived so a bright brand doesn't fade
      // into the unrelated FM navy default.
      root.setProperty('--brand-primary-dark', darken(color, 0.32))
    } else {
      // Fall back to the :root defaults.
      root.removeProperty('--brand-primary')
      root.removeProperty('--brand-primary-hover')
      root.removeProperty('--brand-primary-light')
      root.removeProperty('--brand-primary-dark')
    }
  }

  async function load(id: string | null) {
    if (!import.meta.client) return
    if (!id) { apply(null); return }
    let theme: { brandColor: string | null; orgLevel: string } | null = null
    try { theme = await orgsApi.getBrandTheme(id) } catch { theme = null }
    if (theme?.brandColor) { apply(theme.brandColor); return }
    // No connected brand: a governing body gets the national blue, everyone else
    // the :root FM navy.
    apply(isGoverningBody(theme?.orgLevel) ? GOVERNING_PRIMARY : null)
  }

  watch(orgId, id => load(id), { immediate: true })
}
