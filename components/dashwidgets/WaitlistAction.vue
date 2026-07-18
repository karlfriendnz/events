<!-- Dashboard widget: waitlist pressure — who could be enrolled TODAY -->
<script setup lang="ts">
const waitlistsApi = useWaitlistsApi()
const groupsApi = useGroupsApi()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const loading = ref(true)
const lists = ref<{ id: string; name: string; waiting: number; space: number }[]>([])
async function load() {
  if (!orgId.value) return
  loading.value = true
  // Seam reads: waitlists + connected groups (with capacity) + org membership counts.
  const [wls, allGs, mems] = await Promise.all([
    waitlistsApi.waitlists(orgId.value),
    groupsApi.list(orgId.value),
    groupsApi.membershipsByOrg(orgId.value),
  ])
  const gs = allGs.filter(g => g.waitlistId).map(g => ({ id: g.id, waitlist_id: g.waitlistId, capacity: g.capacity }))
  const counts: Record<string, number> = {}
  for (const m of mems) counts[m.groupId] = (counts[m.groupId] || 0) + 1
  // Per-waitlist waiting count needs its queue (no org-wide entries read — one per list).
  const entriesByList = await Promise.all(wls.map(w => waitlistsApi.entries(w.id)))
  lists.value = wls.map((w: any, i: number) => {
    const waiting = entriesByList[i].filter((e: any) => ['waiting', 'contacted'].includes(e.status)).length
    const space = gs.filter((g: any) => g.waitlist_id === w.id)
      .reduce((a: number, g: any) => a + (g.capacity ? Math.max(0, g.capacity - (counts[g.id] ?? 0)) : 99), 0)
    return { id: w.id, name: w.name, waiting, space }
  }).filter(w => w.waiting > 0).sort((a, b) => b.waiting - a.waiting)
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

const enrollable = computed(() => lists.value.reduce((a, w) => a + Math.min(w.waiting, w.space), 0))
const totalWaiting = computed(() => lists.value.reduce((a, w) => a + w.waiting, 0))
</script>

<template>
  <AppCard title="Waitlists" class="h-full">
    <template #header-action>
      <NuxtLink to="/groups/waitlists" class="text-xs font-medium text-primary hover:underline">Open →</NuxtLink>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <p v-else-if="!totalWaiting" class="text-sm text-gray-400 py-3 text-center">Nobody is waiting right now.</p>
      <template v-else>
        <div v-if="enrollable" class="flex items-center gap-2 text-sm rounded-lg px-3 py-2 mb-2 bg-emerald-50 border border-emerald-200 text-emerald-800">
          <i class="pi pi-user-plus text-emerald-500" />
          <span><b class="font-semibold">{{ enrollable }}</b> {{ enrollable === 1 ? 'person' : 'people' }} could be enrolled today — a connected {{ t('group', false, true) }} has space.</span>
        </div>
        <ul class="divide-y divide-gray-50">
          <li v-for="w in lists.slice(0, 4)" :key="w.id" class="py-1.5 flex items-center gap-2 text-sm">
            <i class="pi pi-hourglass text-gray-300 text-xs" />
            <span class="truncate text-gray-800">{{ w.name }}</span>
            <span class="ml-auto text-xs text-gray-500 shrink-0">{{ w.waiting }} waiting</span>
            <span v-if="w.space > 0" class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium shrink-0">{{ w.space > 90 ? '∞' : w.space }} space</span>
            <span v-else class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">Full</span>
          </li>
        </ul>
      </template>
    </div>
  </AppCard>
</template>
