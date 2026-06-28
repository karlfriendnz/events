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

export function useBrandTheme() {
  const db = useDb()
  const { orgId } = useOrg()

  function apply(color: string | null) {
    if (typeof document === 'undefined') return
    const root = document.documentElement.style
    if (color && clampHex(color)) {
      root.setProperty('--brand-primary', color)
      root.setProperty('--brand-primary-hover', darken(color))
      root.setProperty('--brand-primary-light', rgba(color, 0.06))
    } else {
      // Fall back to the :root defaults.
      root.removeProperty('--brand-primary')
      root.removeProperty('--brand-primary-hover')
      root.removeProperty('--brand-primary-light')
    }
  }

  async function load(id: string | null) {
    if (!import.meta.client) return
    if (!id) { apply(null); return }
    const { data: org } = await (db.from as any)('organisations').select('brand_id').eq('id', id).maybeSingle()
    const brandId = org?.brand_id ?? null
    if (!brandId) { apply(null); return }
    const { data: brand } = await (db.from as any)('brands').select('color').eq('id', brandId).maybeSingle()
    apply(brand?.color ?? null)
  }

  watch(orgId, id => load(id), { immediate: true })
}
