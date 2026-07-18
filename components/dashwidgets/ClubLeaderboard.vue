<!--
  Parent-org dashboard widget: CLUB LEADERBOARD. Ranks the affiliated clubs by
  member count with mini bars. Each row opens that club (switches active org).
  For a governing body; empty/hint state for a club.
-->
<script setup lang="ts">
const admin = useAdminApi()
const { orgId } = useOrg()
const { descendants } = useOrgHierarchy()

const loading = ref(true)
const rows = ref<{ id: string; name: string; count: number }[]>([])
const hasClubs = ref(false)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const desc = await descendants(orgId.value)
  const clubs = (desc ?? []).filter((o: any) => o.org_level === 'CLUB')
  hasClubs.value = clubs.length > 0
  if (!clubs.length) { rows.value = []; loading.value = false; return }
  // Seam read: cross-org member counts (admin rollup), then filter to our clubs.
  const clubIds = new Set(clubs.map((c: any) => c.id))
  const counts: Record<string, number> = {}
  for (const o of await admin.orgsWithCounts()) {
    if (clubIds.has(o.id)) counts[o.id] = o.members
  }
  rows.value = clubs.map((c: any) => ({ id: c.id, name: c.name, count: counts[c.id] || 0 }))
    .sort((a: any, b: any) => b.count - a.count)
  loading.value = false
}
onMounted(load)
watch(orgId, load)

const maxCount = computed(() => Math.max(1, ...rows.value.map(r => r.count)))
function openClub(id: string) {
  // switch the active org to that club, then reload the dashboard for it
  persistActiveOrg(id)
  window.location.href = '/dashboard'
}
</script>

<template>
  <div class="card h-full flex flex-col overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-100 shrink-0"><p class="text-sm font-semibold text-gray-800">Club leaderboard</p></div>
    <div class="p-4 flex-1 overflow-auto">
      <p v-if="loading" class="text-sm text-gray-400">Loading…</p>
      <p v-else-if="!hasClubs" class="text-sm text-gray-400 text-center py-6">Ranks affiliated clubs by members — for a national or regional organisation.</p>
      <div v-else class="space-y-2.5">
        <button v-for="(r, i) in rows" :key="r.id" type="button" class="w-full text-left group" @click="openClub(r.id)">
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="text-gray-700 group-hover:text-primary truncate flex items-center gap-2">
              <span class="w-4 text-right text-xs text-gray-400 tabular-nums">{{ i + 1 }}</span>{{ r.name }}
            </span>
            <span class="font-semibold text-gray-900 tabular-nums shrink-0">{{ r.count }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden ml-6">
            <div class="h-full rounded-full bg-primary/70 group-hover:bg-primary transition-colors" :style="{ width: (r.count / maxCount * 100) + '%' }" />
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
