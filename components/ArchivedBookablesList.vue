<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-gray-900">Archived bookables</h2>
        <p class="text-sm text-gray-500 mt-0.5">Bookables that aren't currently in use. Restore them, or delete permanently if there are no upcoming bookings.</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-12 text-gray-400">
      <i class="pi pi-spin pi-spinner text-xl" />
    </div>

    <div v-else-if="!items.length" class="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
      <i class="pi pi-inbox text-3xl mb-3 block" />
      <p class="text-sm">No archived bookables.</p>
    </div>

    <div v-else class="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
      <div v-for="item in items" :key="item.id" class="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          :class="item.type === 'VENUE' ? 'bg-[#EFF6FF]' : item.type === 'ITEM' ? 'bg-amber-50' : 'bg-green-50'">
          <i class="pi text-sm"
            :class="item.type === 'VENUE' ? 'pi-building text-primary' : item.type === 'ITEM' ? 'pi-box text-amber-600' : 'pi-user text-green-600'" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
          <p v-if="item.location" class="text-xs text-gray-400 truncate">{{ item.location }}</p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span v-if="upcomingCounts[item.id]"
            class="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {{ upcomingCounts[item.id] }} upcoming
          </span>
          <span v-else class="text-xs text-gray-400">No upcoming bookings</span>
          <Button label="Restore" icon="pi pi-undo" severity="secondary" outlined size="small"
            @click="restore(item)" />
          <Button label="Delete" icon="pi pi-trash" severity="danger" outlined size="small"
            :disabled="!!upcomingCounts[item.id]"
            v-tooltip.top="upcomingCounts[item.id] ? 'Cannot delete — has upcoming bookings' : ''"
            @click="confirmDelete(item)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const { orgId } = useOrg()

const emit = defineEmits<{ changed: [] }>()

const items = ref<any[]>([])
const upcomingCounts = ref<Record<string, number>>({})
const loading = ref(true)

async function load() {
  if (!orgId.value) return
  loading.value = true
  try {
    const { data } = await (db.from as any)('bookables')
      .select('id, name, type, location')
      .eq('org_id', orgId.value)
      .eq('status', 'ARCHIVED')
      .order('name')
    items.value = data ?? []

    if (items.value.length) {
      const ids = items.value.map((b: any) => b.id)
      const { data: bk } = await (db.from as any)('bookings')
        .select('bookable_id')
        .in('bookable_id', ids)
        .gte('start_at', new Date().toISOString())
        .neq('status', 'CANCELLED')
      const counts: Record<string, number> = {}
      for (const r of (bk ?? [])) counts[r.bookable_id] = (counts[r.bookable_id] ?? 0) + 1
      upcomingCounts.value = counts
    } else {
      upcomingCounts.value = {}
    }
  } finally {
    loading.value = false
  }
}

async function restore(item: any) {
  const { error } = await (db.from as any)('bookables').update({ status: 'ACTIVE' }).eq('id', item.id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Restore failed', detail: error.message, life: 4000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Restored', detail: `${item.name} is active again.`, life: 2500 })
  await load()
  emit('changed')
}

async function confirmDelete(item: any) {
  if (upcomingCounts.value[item.id]) return
  if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return
  const { error } = await (db.from as any)('bookables').update({ status: 'DELETED' }).eq('id', item.id)
  if (error) {
    toast.add({ severity: 'error', summary: 'Delete failed', detail: error.message, life: 4000 })
    return
  }
  toast.add({ severity: 'success', summary: 'Deleted', life: 2500 })
  items.value = items.value.filter(i => i.id !== item.id)
  emit('changed')
}

watch(orgId, () => load(), { immediate: true })

defineExpose({ reload: load })
</script>
