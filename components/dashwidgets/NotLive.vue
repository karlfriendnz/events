<!-- Dashboard widget: classes that can't take public sign-ups yet (no registration form) -->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const { inActiveLocation, activeLocationId } = useActiveLocation()

const loading = ref(true)
const rows = ref<any[]>([])
async function load() {
  if (!orgId.value) return
  loading.value = true
  const { data } = await (db.from as any)('member_groups')
    .select('id, name, color, location_id')
    .eq('org_id', orgId.value).neq('kind', 'membership').is('form_id', null)
    .order('name').limit(50)
  rows.value = data ?? []
  loading.value = false
}
onMounted(load)
watch(orgId, v => { if (v) load() })
const visible = computed(() => rows.value.filter(r => inActiveLocation(r.location_id)))
</script>

<template>
  <AppCard :title="`Not taking sign-ups`" class="h-full">
    <template #header-action>
      <span class="text-xs font-bold" :class="visible.length ? 'text-amber-600' : 'text-emerald-600'">{{ visible.length }}</span>
    </template>
    <div class="px-4 py-3">
      <div v-if="loading" class="text-sm text-gray-400 py-4">Loading…</div>
      <p v-else-if="!visible.length" class="text-sm text-emerald-700 py-3 text-center"><i class="pi pi-check-circle mr-1" />Every {{ t('group', false, true) }} has a registration form.</p>
      <template v-else>
        <p class="text-xs text-gray-400 mb-2">These {{ t('group', true, true) }} have no registration form, so nobody can sign up online.</p>
        <ul class="divide-y divide-gray-50">
          <li v-for="r in visible.slice(0, 6)" :key="r.id">
            <NuxtLink :to="`/groups/${r.id}`" class="py-1.5 flex items-center gap-2 text-sm hover:text-primary">
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: r.color || '#94a3b8' }" />
              <span class="truncate">{{ r.name }}</span>
              <i class="pi pi-arrow-right text-[10px] ml-auto text-gray-300" />
            </NuxtLink>
          </li>
        </ul>
        <p v-if="visible.length > 6" class="text-xs text-gray-400 mt-1.5">+ {{ visible.length - 6 }} more</p>
      </template>
    </div>
  </AppCard>
</template>
