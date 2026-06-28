<!--
  PROTOTYPE · People directory as a per-TYPE view (driven by ?type= from the left
  menu). Demonstrates "a view per people type". Rows link to the real profile.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const { loadOrgTypes } = useOrgFieldPolicy()

const personTypes = ref<any[]>([])
const people = ref<any[]>([])
const loading = ref(true)

const activeType = computed(() => (route.query.type as string) || null)
const activeDef = computed(() => personTypes.value.find(t => t.key === activeType.value) || null)
const heading = computed(() => activeDef.value ? activeDef.value.label : 'All people')

function typesOf(p: any): string[] {
  if (Array.isArray(p.person_types) && p.person_types.length) return p.person_types
  return p.person_type ? [p.person_type] : []
}
const filtered = computed(() => activeType.value
  ? people.value.filter(p => typesOf(p).includes(activeType.value!))
  : people.value)

async function load() {
  loading.value = true
  if (!orgId.value) { loading.value = false; return }
  const all = await loadOrgTypes(orgId.value)
  personTypes.value = all.filter((t: any) => (t.kind ?? 'person') === 'person')
  const { data } = await (db.from as any)('persons')
    .select('id, first_name, last_name, email, phone, person_type, person_types')
    .eq('org_id', orgId.value).order('last_name')
  people.value = data ?? []
  loading.value = false
}

watch([orgId, () => route.query.type], load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0">
        <div class="mb-4">
          <h1 class="text-xl font-semibold text-gray-900">{{ heading }}</h1>
          <p class="text-sm text-gray-500">{{ filtered.length }} {{ filtered.length === 1 ? 'person' : 'people' }}{{ activeDef ? ' · view of type ' + activeDef.label : '' }}.</p>
        </div>

        <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="!filtered.length" class="card p-8 text-center text-sm text-gray-400">No people in this view.</div>
        <div v-else class="card p-0 overflow-hidden">
          <NuxtLink v-for="p in filtered" :key="p.id" :to="`/proto/people/${p.id}`"
            class="px-4 py-2.5 border-b border-gray-50 flex items-center gap-3 hover:bg-gray-50 transition-colors">
            <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-500 shrink-0">
              {{ (p.first_name?.[0] || '') + (p.last_name?.[0] || '') }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 truncate">{{ p.first_name }} {{ p.last_name }}</p>
              <p class="text-[11px] text-gray-400 truncate">{{ p.email || p.phone || '—' }}</p>
            </div>
            <div class="hidden sm:flex gap-1">
              <span v-for="k in typesOf(p)" :key="k" class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{{ personTypes.find(t => t.key === k)?.label || k }}</span>
            </div>
            <i class="pi pi-chevron-right text-gray-300 text-xs" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
