<!--
  PROTOTYPE · Entity records directory. Driven by ?type= (the left-menu views):
  no type = all organisations; ?type=team = just teams, etc. "New" creates a
  record of the active type (or asks which type).
-->
<script setup lang="ts">
const { orgId } = useOrg()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { resolvePersonTypes } = useOrgFieldPolicy()
const { loadEntities, memberCounts, createEntity } = useEntities()

const entityTypes = ref<any[]>([])
const rows = ref<any[]>([])
const counts = ref<Record<string, number>>({})
const loading = ref(true)
const showNew = ref(false)
const newName = ref('')
const newType = ref<string | null>(null)

const activeType = computed(() => (route.query.type as string) || null)
const activeTypeDef = computed(() => entityTypes.value.find(t => t.key === activeType.value) || null)
const typeLabel = (key: string) => entityTypes.value.find(t => t.key === key)?.label || key
const heading = computed(() => activeTypeDef.value ? activeTypeDef.value.label + 's' : 'All organisations')

async function load() {
  loading.value = true
  if (!orgId.value) { loading.value = false; return }
  const all = await resolvePersonTypes(orgId.value)
  entityTypes.value = all.filter((t: any) => t.kind === 'entity')
  ;[rows.value, counts.value] = await Promise.all([loadEntities(activeType.value || undefined), memberCounts()])
  loading.value = false
}

function openNew() {
  newName.value = ''
  newType.value = activeType.value || entityTypes.value[0]?.key || null
  showNew.value = true
}
async function create() {
  if (!newName.value.trim() || !newType.value) return
  try {
    const id = await createEntity(newType.value, newName.value.trim())
    showNew.value = false
    router.push(`/proto/organisations/${id}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not create', detail: e?.message, life: 4000 })
  }
}

watch([orgId, () => route.query.type], load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full flex flex-col">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6 flex-1 min-h-0">
      <ProtoNav />
      <div class="flex-1 min-w-0">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 class="text-xl font-semibold text-gray-900">{{ heading }}</h1>
            <p class="text-sm text-gray-500">{{ activeTypeDef ? 'Records of type ' + activeTypeDef.label : 'Every team, business, school and family' }}.</p>
          </div>
          <Button :label="activeTypeDef ? 'New ' + activeTypeDef.label : 'New'" icon="pi pi-plus" size="small"
            :disabled="!entityTypes.length" @click="openNew" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>

        <div v-if="!entityTypes.length && !loading" class="card p-8 text-center text-sm text-gray-500">
          No entity types defined yet. <NuxtLink to="/proto/entity-types" class="text-primary hover:underline">Create one in Teams &amp; organisations →</NuxtLink>
        </div>
        <div v-else-if="loading" class="text-sm text-gray-400">Loading…</div>
        <div v-else-if="!rows.length" class="card p-8 text-center text-sm text-gray-400">
          No {{ activeTypeDef ? activeTypeDef.label.toLowerCase() + 's' : 'organisations' }} yet. Create one to get started.
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <NuxtLink v-for="r in rows" :key="r.id" :to="`/proto/organisations/${r.id}`"
            class="card p-4 hover:shadow-md transition-shadow block">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-semibold text-gray-900 truncate">{{ r.name }}</p>
                <p class="text-[11px] uppercase tracking-wide text-violet-500 mt-0.5">{{ typeLabel(r.type_key) }}</p>
              </div>
              <i class="pi pi-building text-gray-300" />
            </div>
            <p class="text-xs text-gray-500 mt-3"><i class="pi pi-users text-[10px] mr-1" />{{ counts[r.id] || 0 }} attached</p>
          </NuxtLink>
        </div>

        <Dialog v-model:visible="showNew" modal header="New organisation" :style="{ width: '95vw', maxWidth: '420px' }">
          <div class="space-y-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Type</label>
              <Select v-model="newType" :options="entityTypes" optionLabel="label" optionValue="key" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Name</label>
              <InputText v-model="newName" placeholder="e.g. U12 Tigers" class="w-full" autofocus @keyup.enter="create" />
            </div>
          </div>
          <template #footer>
            <Button label="Cancel" text size="small" @click="showNew = false" />
            <Button label="Create" size="small" :disabled="!newName.trim() || !newType" @click="create" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
          </template>
        </Dialog>
        <Toast />
      </div>
    </div>
  </div>
</template>
