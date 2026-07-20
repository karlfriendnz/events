<!-- Dashboard widget: spots filled vs capacity across classes (lens-aware) -->
<script setup lang="ts">
import { isMembershipGroup } from '~/composables/useMemberships'
const groupsApi = useGroupsApi()
const { orgId } = useOrg()
const scoped = useScopedRoles()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const { inActiveLocation, activeLocationId } = useActiveLocation()

const loading = ref(true)
const groups = ref<any[]>([])
const counts = ref<Record<string, number>>({})
async function load() {
  if (!orgId.value) return
  loading.value = true
  // Seam reads: all groups (keep classes) + all org memberships for the roster counts.
  const [gs, mems] = await Promise.all([
    groupsApi.list(orgId.value),
    groupsApi.membershipsByOrg(orgId.value),
    scoped.loadRoleDefs(),
  ])
  groups.value = gs.filter(g => !isMembershipGroup(g)).map(g => ({ id: g.id, capacity: g.capacity, location_id: g.locationId }))
  const c: Record<string, number> = {}
  // Capacity is a MEMBER cap — staff (coaches/managers) don't take a spot.
  for (const m of mems) {
    if (scoped.isStaff('group', scoped.normalizeRoles('group', m.roles, m.role))) continue
    c[m.groupId] = (c[m.groupId] || 0) + 1
  }
  counts.value = c
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })

const m = computed(() => {
  const inLens = groups.value.filter(g => inActiveLocation(g.location_id))
  const capped = inLens.filter(g => g.capacity)
  const cap = capped.reduce((a, g) => a + g.capacity, 0)
  const filled = capped.reduce((a, g) => a + Math.min(counts.value[g.id] ?? 0, g.capacity), 0)
  const full = capped.filter(g => (counts.value[g.id] ?? 0) >= g.capacity).length
  return { cap, filled, full, pct: cap ? Math.round((filled / cap) * 100) : null }
})
</script>

<template>
  <NuxtLink to="/groups/reports" class="card h-full p-0 overflow-hidden flex items-stretch hover:shadow-md transition-all">
    <div class="w-12 md:w-16 shrink-0 flex items-center justify-center text-white"
      :style="{ backgroundColor: (m.pct ?? 0) >= 90 ? '#DC2626' : (m.pct ?? 0) >= 75 ? '#D97706' : '#10B981' }">
      <i class="pi pi-chart-pie text-base md:text-xl" />
    </div>
    <div class="min-w-0 flex-1 px-3 md:px-4 flex flex-col justify-center">
      <p class="text-xl md:text-3xl font-bold text-gray-900 leading-none">{{ loading ? '…' : (m.pct != null ? m.pct + '%' : '—') }}</p>
      <p class="text-[11px] md:text-sm font-medium text-gray-600 mt-0.5 md:mt-1.5">Utilisation</p>
      <p class="hidden md:block text-[11px] text-gray-400 truncate">{{ m.filled }}/{{ m.cap }} spots · {{ m.full }} full</p>
    </div>
  </NuxtLink>
</template>
