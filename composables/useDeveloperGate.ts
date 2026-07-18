// Developer gate — restricts users tagged as developers (via Supabase
// app_metadata.role = 'developer') to pages whose page_reviews.stage is
// 'approved'. Each tab on a page has its own approval state so the gate
// keys on the same `pageKey` shape used by <ReviewWidget>: route pattern
// + optional ?tab=… (e.g. `/activities/:id?tab=details`).
//
// Returns reactive flags the layout can use to switch between rendering
// the page slot and a "not approved yet" stub. Also exposes the list of
// approved pages without dynamic params, so the stub can show navigable
// links.

export function useDeveloperGate() {
  const route = useRoute()
  const reviewsApi = useReviewsApi()
  const user = useSupabaseUser()
  const { orgId } = useOrg()

  const isDeveloper = computed(() => {
    const meta = (user.value as any)?.app_metadata
    return meta?.role === 'developer'
  })

  const pageKey = computed(() => {
    const matched = route.matched[route.matched.length - 1]
    const base = matched?.path || route.path
    const tab = route.query.tab
    return tab ? `${base}?tab=${tab}` : base
  })

  const loaded = ref(false)
  const stage = ref<string | null>(null)

  async function loadCurrent() {
    if (!isDeveloper.value || !orgId.value) {
      loaded.value = true
      return
    }
    loaded.value = false
    stage.value = await reviewsApi.stage(orgId.value, pageKey.value)
    loaded.value = true
  }
  watch([orgId, pageKey, isDeveloper], loadCurrent, { immediate: true })

  const pageApproved = computed(() => stage.value === 'approved')
  const blocked = computed(() => isDeveloper.value && loaded.value && !pageApproved.value)

  // Approved pages the developer can actually navigate to — i.e. those
  // without dynamic `:param` segments. Loaded on demand for the gate stub.
  const approvedNavigable = ref<{ path: string; tab: string | null }[]>([])
  async function loadApprovedNavigable() {
    if (!isDeveloper.value || !orgId.value) return
    const paths = await reviewsApi.approvedPaths(orgId.value)
    approvedNavigable.value = paths
      .filter((p: string) => !p.includes(':'))
      .map((p: string) => {
        const m = p.match(/^([^?]+)(?:\?tab=(.+))?$/)
        return { path: m?.[1] ?? p, tab: m?.[2] ?? null }
      })
      .sort((a, b) => a.path.localeCompare(b.path))
  }

  return {
    isDeveloper,
    pageKey,
    loaded,
    stage,
    pageApproved,
    blocked,
    approvedNavigable,
    loadApprovedNavigable,
  }
}
