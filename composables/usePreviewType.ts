// "Preview as a person type" — an admin impersonates a person type (Parent,
// Member…) to see what the app looks like for them: their menu, permissions and
// landing dashboard. It's a VIEW override only (no auth/session change) — while a
// preview is active, useCan / useAccessLevel / the nav / the dashboard resolve
// against the previewed type instead of the real user.
//
// Persisted in sessionStorage + entered via a full reload so every resolver picks
// it up cleanly on the next load (no cache-invalidation plumbing). Cleared with
// exitPreview(), which reloads back to Settings.
export function usePreviewType() {
  const previewKey = useState<string | null>('fm_preview_type', () => (import.meta.client ? sessionStorage.getItem('fm_preview_type') : null))
  const previewLabel = useState<string | null>('fm_preview_label', () => (import.meta.client ? sessionStorage.getItem('fm_preview_label') : null))
  const active = computed(() => !!previewKey.value)

  function startPreview(key: string, label: string) {
    if (!import.meta.client) return
    sessionStorage.setItem('fm_preview_type', key)
    sessionStorage.setItem('fm_preview_label', label)
    window.location.href = '/dashboard'
  }
  function exitPreview() {
    if (!import.meta.client) return
    sessionStorage.removeItem('fm_preview_type')
    sessionStorage.removeItem('fm_preview_label')
    window.location.href = '/settings/fields'
  }
  return { previewKey, previewLabel, active, startPreview, exitPreview }
}
