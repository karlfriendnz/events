export interface Crumb { label: string; to?: string }
// Labels may be passed as a plain string, a ref, or a getter (e.g. a computed
// that resolves once the entity loads).
type CrumbInput = { label: MaybeRefOrGetter<string>; to?: string }

export function useBreadcrumbs(crumbs?: CrumbInput[]) {
  const state = useState<Crumb[]>('breadcrumbs', () => [])
  if (crumbs) {
    // Keep the top-bar breadcrumbs in sync with any reactive labels.
    watchEffect(() => {
      state.value = crumbs.map(c => ({ label: toValue(c.label), to: c.to }))
    })
    // Clear when the page that set them unmounts so they don't linger.
    onScopeDispose(() => { state.value = [] })
  }
  return state
}
