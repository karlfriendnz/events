<!--
  Parent-org dashboard widget: NETWORK OVERVIEW. For a governing body (national /
  regional / association), aggregates across every affiliated club beneath it —
  club count, total members across the network, and a per-level breakdown.
  Empty/hint state for a club (no descendants).
-->
<script setup lang="ts">
const orgsApi = useOrganisationsApi()
const admin = useAdminApi()
const { orgId } = useOrg()
const { descendants } = useOrgHierarchy()

const loading = ref(true)
const orgLevel = ref<string | null>(null)
const clubCount = ref(0)
const totalMembers = ref(0)
const byLevel = ref<{ label: string; count: number }[]>([])

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [org, desc] = await Promise.all([
    orgsApi.get(orgId.value),
    descendants(orgId.value),
  ])
  orgLevel.value = org?.orgLevel ?? null
  const clubs = (desc ?? []).filter((o: any) => o.org_level === 'CLUB')
  clubCount.value = clubs.length
  // per-level breakdown of the whole subtree
  const levels: Record<string, number> = {}
  for (const o of (desc ?? [])) levels[o.org_level] = (levels[o.org_level] || 0) + 1
  byLevel.value = ['REGIONAL', 'ASSOCIATION', 'CLUB', 'RST'].filter(l => levels[l]).map(l => ({ label: orgLevelLabel(l), count: levels[l] }))
  // aggregate members across descendant clubs (admin cross-org rollup).
  const clubIds = new Set(clubs.map((c: any) => c.id))
  if (clubIds.size) {
    const rows = await admin.orgsWithCounts()
    totalMembers.value = rows.filter(o => clubIds.has(o.id)).reduce((a, o) => a + o.members, 0)
  } else totalMembers.value = 0
  loading.value = false
}
onMounted(load)
watch(orgId, load)

const isParent = computed(() => isGoverningBody(orgLevel.value))
</script>

<template>
  <div class="card h-full flex flex-col overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-100 shrink-0"><p class="text-sm font-semibold text-gray-800">Network overview</p></div>
    <div class="p-4 flex-1 overflow-auto">
      <p v-if="loading" class="text-sm text-gray-400">Loading…</p>
      <p v-else-if="!isParent && !clubCount" class="text-sm text-gray-400 text-center py-6">This widget summarises affiliated clubs — it's for a national or regional organisation.</p>
      <template v-else>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-gray-50 p-3">
            <p class="text-2xl font-bold text-gray-900 leading-none">{{ clubCount }}</p>
            <p class="text-xs text-gray-500 mt-1">Affiliated clubs</p>
          </div>
          <div class="rounded-xl bg-gray-50 p-3">
            <p class="text-2xl font-bold text-gray-900 leading-none">{{ totalMembers.toLocaleString() }}</p>
            <p class="text-xs text-gray-500 mt-1">Members across the network</p>
          </div>
        </div>
        <div v-if="byLevel.length" class="mt-4 space-y-1.5">
          <p class="text-[11px] font-bold uppercase tracking-wide text-gray-400">By level</p>
          <div v-for="l in byLevel" :key="l.label" class="flex items-center justify-between text-sm">
            <span class="text-gray-600">{{ l.label }}</span>
            <span class="font-semibold text-gray-900">{{ l.count }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
