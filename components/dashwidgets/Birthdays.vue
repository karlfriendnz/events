<!-- Dashboard widget: birthdays in the next 7 days -->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()

const loading = ref(true)
const rows = ref<{ id: string; name: string; when: string; turning: number }[]>([])

async function load() {
  if (!orgId.value) return
  loading.value = true
  const { data } = await (db.from as any)('persons')
    .select('id, first_name, last_name, dob').eq('org_id', orgId.value).not('dob', 'is', null).limit(2000)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const out: typeof rows.value = []
  for (const p of (data ?? [])) {
    const dob = new Date(p.dob)
    if (isNaN(dob.getTime())) continue
    const next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate())
    if (next < today) next.setFullYear(next.getFullYear() + 1)
    const days = Math.round((next.getTime() - today.getTime()) / 86400000)
    if (days <= 7) {
      out.push({
        id: p.id,
        name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
        when: days === 0 ? 'Today 🎂' : days === 1 ? 'Tomorrow' : next.toLocaleDateString('en-NZ', { weekday: 'long' }),
        turning: next.getFullYear() - dob.getFullYear(),
      })
    }
  }
  rows.value = out.sort((a, b) => (a.when === 'Today 🎂' ? -1 : 1)).slice(0, 8)
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })
</script>

<template>
  <AppCard title="Birthdays this week" class="h-full">
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <p v-else-if="!rows.length" class="text-sm text-gray-400 py-3 text-center">No birthdays in the next 7 days.</p>
      <ul v-else class="divide-y divide-gray-50">
        <li v-for="r in rows" :key="r.id">
          <NuxtLink :to="`/people/${r.id}`" class="py-1.5 flex items-center gap-2 text-sm hover:text-primary">
            <i class="pi pi-gift text-pink-400 text-xs shrink-0" />
            <span class="truncate">{{ r.name }}</span>
            <span class="text-xs text-gray-400 shrink-0">turns {{ r.turning }}</span>
            <span class="ml-auto text-xs font-medium shrink-0" :class="r.when.startsWith('Today') ? 'text-pink-500' : 'text-gray-400'">{{ r.when }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </AppCard>
</template>
