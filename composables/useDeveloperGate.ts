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
  const db = useDb()
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
    const { data } = await (db.from as any)('page_reviews')
      .select('stage')
      .eq('org_id', orgId.value)
      .eq('path', pageKey.value)
      .maybeSingle()
    stage.value = data?.stage ?? null
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
    const { data } = await (db.from as any)('page_reviews')
      .select('path, stage')
      .eq('org_id', orgId.value)
      .eq('stage', 'approved')
    approvedNavigable.value = (data ?? [])
      .filter((r: any) => !r.path.includes(':'))
      .map((r: any) => {
        const m = r.path.match(/^([^?]+)(?:\?tab=(.+))?$/)
        return { path: m?.[1] ?? r.path, tab: m?.[2] ?? null }
      })
      .sort((a: any, b: any) => a.path.localeCompare(b.path))
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
