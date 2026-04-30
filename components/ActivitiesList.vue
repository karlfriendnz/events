<template>
  <div class="space-y-4 max-w-2xl mx-auto w-full">

    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-gray-900">Activities</h2>
        <p class="text-sm text-gray-500 mt-0.5">Named activities that happen at your venues — e.g. Tennis, Badminton, 5-a-side</p>
      </div>
      <Button label="New activity" icon="pi pi-plus" size="small"
        @click="openCreate" style="background:#1E2157;border-color:#1E2157" />
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20 text-gray-400">
      <i class="pi pi-spin pi-spinner text-xl" />
    </div>

    <!-- Empty -->
    <div v-else-if="!activities.length"
      class="text-center py-16 px-6 bg-white rounded-xl border-2 border-dashed border-[#1E2157]/20">
      <div class="w-16 h-16 mx-auto rounded-full bg-[#EFF6FF] flex items-center justify-center mb-4">
        <i class="pi pi-bolt text-2xl text-[#1E2157]" />
      </div>
      <h3 class="text-base font-semibold text-gray-900 mb-1">Create your first activity</h3>
      <p class="text-sm text-gray-500 mb-5 max-w-sm mx-auto">
        Activities are what people do at your venues — Tennis, Badminton, 5-a-side. Add one to get started.
      </p>
      <Button label="New activity" icon="pi pi-plus"
        style="background:#1E2157;border-color:#1E2157" @click="openCreate" />
    </div>

    <!-- List -->
    <div v-else class="flex flex-col gap-3">
      <NuxtLink v-for="a in activities" :key="a.id" :to="`/activities/${a.id}`"
        class="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer group">
        <img v-if="a.image_url" :src="a.image_url"
          class="w-12 h-12 rounded-xl object-cover shrink-0" />
        <div v-else class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
          :style="{ background: a.color + '22', color: a.color }">
          <i :class="`pi ${a.icon} text-lg`" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800 truncate group-hover:text-[#1E2157]">{{ a.name }}</p>
          <p v-if="a.description" class="text-xs text-gray-400 mt-0.5 truncate">{{ a.description }}</p>
          <div class="flex items-center gap-2 mt-1.5">
            <span class="text-[11px] text-gray-400">{{ venueCount[a.id] ?? 0 }} venue{{ (venueCount[a.id] ?? 0) === 1 ? '' : 's' }}</span>
            <span class="text-[11px] px-1.5 py-0.5 rounded-full"
              :class="a.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'">
              {{ a.status === 'ACTIVE' ? 'Active' : 'Archived' }}
            </span>
          </div>
        </div>
        <i class="pi pi-chevron-right text-gray-300 text-xs mt-1 group-hover:text-indigo-400" />
      </NuxtLink>
    </div>

    <!-- Create dialog -->
    <Dialog v-model:visible="showCreate" modal header="New activity" style="width:420px">
      <div class="space-y-4 pt-2">
        <div class="flex items-center gap-3">
          <label class="text-sm font-medium text-gray-700 w-24 shrink-0">Name</label>
          <InputText v-model="newName" placeholder="e.g. Tennis, Badminton" class="flex-1" autofocus />
        </div>
        <div class="flex items-center gap-3">
          <label class="text-sm font-medium text-gray-700 w-24 shrink-0">Colour</label>
          <div class="flex gap-2 flex-wrap">
            <button v-for="c in COLORS" :key="c" type="button"
              class="w-6 h-6 rounded-full ring-offset-2 transition-all"
              :style="{ background: c }"
              :class="newColor === c ? 'ring-2 ring-gray-700' : 'hover:ring-2 hover:ring-gray-300'"
              @click="newColor = c" />
          </div>
        </div>
        <div class="flex items-start gap-3">
          <label class="text-sm font-medium text-gray-700 w-24 shrink-0 pt-1">Description</label>
          <Textarea v-model="newDescription" placeholder="Optional description" auto-resize rows="2" class="flex-1 text-sm" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" icon="pi pi-check" :loading="creating" :disabled="!newName.trim()"
          @click="create" style="background:#1E2157;border-color:#1E2157" />
      </template>
    </Dialog>

  </div>
</template>

<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()

const COLORS = ['#6366F1','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#84CC16']

const activities = ref<any[]>([])
const venueCount = ref<Record<string, number>>({})
const loading = ref(true)

const showCreate = ref(false)
const creating = ref(false)
const newName = ref('')
const newColor = ref(COLORS[0])
const newDescription = ref('')

async function load() {
  loading.value = true
  try {
    const { data } = await (db.from as any)('activities')
      .select('*').eq('org_id', orgId.value).order('sort_order').order('name')
    activities.value = data ?? []

    if (activities.value.length) {
      const { data: links } = await (db.from as any)('activity_bookables')
        .select('activity_id').in('activity_id', activities.value.map((a: any) => a.id))
      const counts: Record<string, number> = {}
      for (const l of links ?? []) {
        counts[l.activity_id] = (counts[l.activity_id] ?? 0) + 1
      }
      venueCount.value = counts
    }
  } finally {
    loading.value = false
  }
}

function openCreate() {
  newName.value = ''
  newColor.value = COLORS[0]
  newDescription.value = ''
  showCreate.value = true
}

async function create() {
  if (!newName.value.trim()) return
  creating.value = true
  try {
    const { data } = await (db.from as any)('activities').insert({
      org_id: orgId.value,
      name: newName.value.trim(),
      description: newDescription.value.trim() || null,
      color: newColor.value,
    }).select().single()
    showCreate.value = false
    navigateTo(`/activities/${data.id}`)
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>
