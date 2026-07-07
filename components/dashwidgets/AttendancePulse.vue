<!-- Dashboard widget: today's sessions + yesterday's unmarked rolls -->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const { inActiveLocation } = useActiveLocation()

const loading = ref(true)
const today = ref<any[]>([])
const yesterdayMarked = ref<{ marked: number; total: number } | null>(null)

async function load() {
  if (!orgId.value) return
  loading.value = true
  const d0 = new Date(); d0.setHours(0, 0, 0, 0)
  const d1 = new Date(d0); d1.setDate(d1.getDate() + 1)
  const y0 = new Date(d0); y0.setDate(y0.getDate() - 1)
  const [{ data: te }, { data: ye }] = await Promise.all([
    (db.from as any)('events').select('id, title, start_at, member_group:member_groups(id, name, color, location_id)')
      .eq('org_id', orgId.value).not('member_group_id', 'is', null)
      .gte('start_at', d0.toISOString()).lt('start_at', d1.toISOString()).order('start_at'),
    (db.from as any)('events').select('id')
      .eq('org_id', orgId.value).not('member_group_id', 'is', null)
      .gte('start_at', y0.toISOString()).lt('start_at', d0.toISOString()),
  ])
  today.value = (te ?? []).filter((e: any) => inActiveLocation(e.member_group?.location_id))
  const yids = (ye ?? []).map((e: any) => e.id)
  if (yids.length) {
    const { data: att } = await (db.from as any)('attendance').select('event_id').in('event_id', yids)
    const markedIds = new Set((att ?? []).map((a: any) => a.event_id))
    yesterdayMarked.value = { marked: markedIds.size, total: yids.length }
  } else yesterdayMarked.value = null
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true })
</script>

<template>
  <AppCard title="Attendance" class="h-full">
    <template #header-action>
      <NuxtLink to="/attendance" class="text-xs font-medium text-primary hover:underline">All sessions →</NuxtLink>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <template v-else>
        <p v-if="yesterdayMarked && yesterdayMarked.marked < yesterdayMarked.total"
          class="flex items-center gap-2 text-xs rounded-lg px-3 py-2 mb-2 bg-amber-50 border border-amber-200 text-amber-800">
          <i class="pi pi-exclamation-circle" /> {{ yesterdayMarked.total - yesterdayMarked.marked }} of yesterday's {{ yesterdayMarked.total }} rolls weren't marked.
        </p>
        <p v-if="!today.length" class="text-sm text-gray-400 py-3 text-center">No sessions today.</p>
        <ul v-else class="divide-y divide-gray-50">
          <li v-for="e in today.slice(0, 5)" :key="e.id" class="py-1.5 flex items-center gap-2 text-sm">
            <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: e.member_group?.color || '#94a3b8' }" />
            <span class="truncate text-gray-800">{{ e.member_group?.name }}</span>
            <span class="text-xs text-gray-400 shrink-0">{{ fmtTime(e.start_at) }}</span>
            <NuxtLink :to="`/events/${e.id}?tab=attendance`" class="ml-auto text-xs font-medium text-primary hover:underline shrink-0">Take roll →</NuxtLink>
          </li>
        </ul>
      </template>
    </div>
  </AppCard>
</template>
