<!-- Dashboard widget: memberships by umbrella/tier + new this month -->
<script setup lang="ts">
const groupsApi = useGroupsApi()
const { orgId } = useOrg()
const gc = useGroupCodes()

const loading = ref(true)
const umbrellas = ref<{ name: string; color: string | null; tiers: { id: string; name: string; n: number }[] }[]>([])
const total = ref(0)
const newThisMonth = ref(0)

async function load() {
  if (!orgId.value) return
  loading.value = true
  // Seam reads: codes + all groups (keep membership-kind); memberships (with start_date)
  // come via the retention projection, which carries startDate + groupId.
  const [codes, allGs] = await Promise.all([
    gc.loadCodes(),
    groupsApi.list(orgId.value),
  ])
  const gs = allGs.filter(g => g.kind === 'membership')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(g => ({ id: g.id, name: g.name, color: g.color, code_id: g.codeId }))
  const mems = await groupsApi.membershipsForRetention(gs.map(g => g.id))
  const codesById: Record<string, any> = Object.fromEntries((codes ?? []).map((c: any) => [c.id, c]))
  const counts: Record<string, number> = {}
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  let fresh = 0
  for (const m of mems) {
    counts[m.groupId] = (counts[m.groupId] || 0) + 1
    if (m.startDate && new Date(m.startDate) >= monthStart) fresh++
  }
  total.value = mems.length
  newThisMonth.value = fresh
  const byCode: Record<string, any[]> = {}
  const loose: any[] = []
  for (const g of gs) (g.code_id ? (byCode[g.code_id] ??= []).push(g) : loose.push(g))
  const out: typeof umbrellas.value = Object.entries(byCode).map(([cid, list]) => ({
    name: codesById[cid]?.name ?? 'Programme', color: codesById[cid]?.color ?? null,
    tiers: list.map(g => ({ id: g.id, name: g.name, n: counts[g.id] ?? 0 })),
  }))
  if (loose.length) out.push({ name: 'Standalone', color: null, tiers: loose.map(g => ({ id: g.id, name: g.name, n: counts[g.id] ?? 0 })) })
  umbrellas.value = out
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })
</script>

<template>
  <AppCard title="Memberships" class="h-full">
    <template #header-action>
      <NuxtLink to="/memberships" class="text-xs font-medium text-primary hover:underline">Open →</NuxtLink>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <p v-else-if="!umbrellas.length" class="text-sm text-gray-400 py-3 text-center">No memberships yet — <NuxtLink to="/memberships" class="text-primary hover:underline">create one →</NuxtLink></p>
      <template v-else>
        <p class="text-2xl font-bold text-gray-900 leading-none mb-0.5">{{ total }}</p>
        <p class="text-xs text-gray-400 mb-2">active membership{{ total === 1 ? '' : 's' }}<span v-if="newThisMonth" class="text-emerald-600 font-medium"> · +{{ newThisMonth }} this month</span></p>
        <div v-for="u in umbrellas" :key="u.name" class="mb-2">
          <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{{ u.name }}</p>
          <div class="flex flex-wrap gap-1.5">
            <NuxtLink v-for="tier in u.tiers" :key="tier.id" :to="`/memberships/${tier.id}`"
              class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-gray-50 border border-gray-200 hover:border-primary text-gray-700">
              {{ tier.name }} <b class="font-semibold">{{ tier.n }}</b>
            </NuxtLink>
          </div>
        </div>
      </template>
    </div>
  </AppCard>
</template>
