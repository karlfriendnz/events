<!-- Dashboard widget: the club's locations side by side (multi-site only) -->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const { locations, ensureLocations } = useActiveLocation()

const loading = ref(true)
const rows = ref<{ id: string; name: string; color: string | null; classes: number; members: number; pct: number | null }[]>([])
async function load() {
  if (!orgId.value) return
  loading.value = true
  await ensureLocations()
  const [{ data: gs }, { data: mems }] = await Promise.all([
    (db.from as any)('member_groups').select('id, capacity, location_id').eq('org_id', orgId.value).neq('kind', 'membership').not('location_id', 'is', null),
    (db.from as any)('member_group_memberships').select('person_id, group_id, group:member_groups!inner(org_id, location_id)').eq('group.org_id', orgId.value).not('group.location_id', 'is', null),
  ])
  const counts: Record<string, number> = {}
  for (const m of (mems ?? [])) counts[m.group_id] = (counts[m.group_id] || 0) + 1
  rows.value = locations.value.map(l => {
    const classes = (gs ?? []).filter((g: any) => g.location_id === l.id)
    const people = new Set((mems ?? []).filter((m: any) => m.group?.location_id === l.id).map((m: any) => m.person_id))
    const capped = classes.filter((g: any) => g.capacity)
    const cap = capped.reduce((a: number, g: any) => a + g.capacity, 0)
    const filled = capped.reduce((a: number, g: any) => a + Math.min(counts[g.id] ?? 0, g.capacity), 0)
    return { id: l.id, name: l.name, color: l.color, classes: classes.length, members: people.size, pct: cap ? Math.round((filled / cap) * 100) : null }
  })
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })
</script>

<template>
  <AppCard title="Locations" class="h-full">
    <template #header-action>
      <NuxtLink to="/settings/locations" class="text-xs font-medium text-primary hover:underline">Manage →</NuxtLink>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <p v-else-if="rows.length < 2" class="text-sm text-gray-400 py-3 text-center">Add a second location to compare sites.</p>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="text-left text-[10px] font-bold uppercase tracking-wide text-gray-400">
            <th class="py-1">Site</th><th class="py-1 text-right">{{ t('group', true) }}</th><th class="py-1 text-right">{{ t('member', true) }}</th><th class="py-1 text-right">Util.</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          <tr v-for="r in rows" :key="r.id">
            <td class="py-1.5"><span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full shrink-0" :style="{ background: r.color || '#94a3b8' }" />{{ r.name }}</span></td>
            <td class="py-1.5 text-right num">{{ r.classes }}</td>
            <td class="py-1.5 text-right num">{{ r.members }}</td>
            <td class="py-1.5 text-right num font-semibold" :class="(r.pct ?? 0) >= 90 ? 'text-red-600' : (r.pct ?? 0) >= 75 ? 'text-amber-600' : 'text-emerald-600'">{{ r.pct != null ? r.pct + '%' : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </AppCard>
</template>
