<template>
  <div class="flex overflow-hidden" style="height: calc(100vh - 3.5rem)">

    <!-- Left: venue tree -->
    <div class="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">

      <!-- Header -->
      <div class="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-semibold text-gray-800">Venues</h2>
          <p class="text-xs text-gray-400 mt-0.5">{{ allBookables.length }} venue{{ allBookables.length !== 1 ? 's' : '' }}</p>
        </div>
        <Button icon="pi pi-plus" size="small" v-tooltip.left="'Add venue'" @click="openNew(null)"
          style="background:#1E2157;border-color:#1E2157" />
      </div>

      <!-- Tree -->
      <div class="flex-1 overflow-y-auto">
        <div v-if="loading" class="py-8 flex justify-center">
          <i class="pi pi-spin pi-spinner text-gray-400" />
        </div>
        <div v-else-if="!rootNodes.length" class="py-10 text-center text-sm text-gray-400">
          <i class="pi pi-building text-2xl block mb-2 text-gray-300" />
          No venues yet
        </div>
        <template v-else>
          <BookableTreeNode
            v-for="node in rootNodes"
            :key="node.id"
            :node="node"
            :selectedId="selectedId"
            @select="openEdit"
            @add-child="openNew" />
        </template>
      </div>

    </div>

    <!-- Right: editor -->
    <div class="flex-1 overflow-hidden flex flex-col bg-[#F5F8FA]">
      <div v-if="!showEditor" class="flex-1 flex flex-col items-center justify-center text-center gap-2 text-gray-400">
        <i class="pi pi-building text-3xl text-gray-300" />
        <p class="text-sm font-medium">Select a venue to edit</p>
        <p class="text-xs text-gray-400">or <button class="text-[#1E2157] hover:underline" @click="openNew(null)">create a new one</button></p>
      </div>
      <div v-else class="flex-1 overflow-hidden flex flex-col bg-white">
        <div class="px-6 py-4 border-b border-gray-100 shrink-0 flex items-center gap-3">
          <div class="flex-1">
            <h2 class="text-sm font-semibold text-gray-800">
              {{ editingBookable ? editingBookable.name || 'Untitled venue' : 'New venue' }}
            </h2>
            <p v-if="editingParent" class="text-xs text-gray-400 mt-0.5">Under {{ editingParent.name }}</p>
          </div>
          <span v-if="editingBookable" class="text-xs px-2 py-0.5 rounded-full font-medium"
            :class="editingBookable.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
            {{ editingBookable.status }}
          </span>
        </div>
        <BookableEditor
          :bookable="editingBookable"
          :parentId="editingParentId"
          @saved="onSaved"
          @cancel="showEditor = false; selectedId = null"
          @delete="onDelete" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
const db = useDb()

const allBookables = ref<any[]>([])
const loading = ref(true)
const selectedId = ref<string | null>(null)
const editingBookable = ref<any>(null)
const editingParentId = ref<string | null>(null)
const showEditor = ref(false)

const toast = useToast()

const editingParent = computed(() =>
  editingParentId.value ? allBookables.value.find(b => b.id === editingParentId.value) : null
)

async function load() {
  loading.value = true
  const { data } = await db.from('bookables')
    .select('id, name, internal_name, description, location, sports, features, layouts, max_concurrent, rules, status, is_public, show_location, parent_id, sort_order, type, default_booking_view, allow_multiple_layouts, show_in_menu')
    .eq('org_id', orgId.value)
    .eq('type', 'VENUE')
    .neq('status', 'DELETED')
    .order('sort_order')
    .order('name')
  allBookables.value = data ?? []
  loading.value = false
}

function buildTree(parentId: string | null): any[] {
  return allBookables.value
    .filter(b => b.parent_id === parentId)
    .map(b => ({ ...b, children: buildTree(b.id) }))
}

const rootNodes = computed(() => buildTree(null))

function openNew(parentId: string | null) {
  selectedId.value = null
  editingBookable.value = null
  editingParentId.value = parentId
  showEditor.value = true
}

function openEdit(bookable: any) {
  selectedId.value = bookable.id
  editingBookable.value = bookable
  editingParentId.value = bookable.parent_id ?? null
  showEditor.value = true
}

function onSaved(saved: any) {
  const idx = allBookables.value.findIndex(b => b.id === saved.id)
  if (idx !== -1) {
    allBookables.value[idx] = saved
  } else {
    allBookables.value.push(saved)
  }
  editingBookable.value = saved
  selectedId.value = saved.id
  toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
}

async function onDelete() {
  if (!editingBookable.value?.id) return
  const ok = confirm(`Delete "${editingBookable.value.name}"? This cannot be undone.`)
  if (!ok) return
  await db.from('bookables').update({ status: 'DELETED' }).eq('id', editingBookable.value.id)
  allBookables.value = allBookables.value.filter(b => b.id !== editingBookable.value.id)
  showEditor.value = false
  selectedId.value = null
  editingBookable.value = null
  toast.add({ severity: 'success', summary: 'Deleted', life: 2000 })
}

onMounted(load)
</script>
