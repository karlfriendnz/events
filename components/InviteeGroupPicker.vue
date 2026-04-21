<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div class="grid grid-cols-2 divide-x divide-gray-200">

      <!-- Left: group browser -->
      <div class="p-5 space-y-3">
        <p class="text-sm font-semibold text-gray-800">Choose groups</p>
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search groups…" size="small" class="w-full" />
        </IconField>
        <div class="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          <div v-if="loading" class="py-6 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-gray-300 block mb-1" />Loading…
          </div>
          <template v-else-if="filteredTree.length">
            <template v-for="parent in filteredTree" :key="parent.id">
              <!-- Parent row -->
              <div class="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100 hover:bg-gray-100 transition-colors">
                <button class="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0"
                  @click="expandedIds[parent.id] = !expandedIds[parent.id]">
                  <i :class="`pi text-xs ${expandedIds[parent.id] ? 'pi-chevron-down' : 'pi-chevron-right'}`" />
                </button>
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: parent.color ?? '#94a3b8' }" />
                <span class="flex-1 text-sm font-semibold text-gray-800">{{ parent.name }}</span>
                <span class="text-xs text-gray-400 mr-1">{{ parent._memberCount }}</span>
                <Button
                  :label="modelValue.includes(parent.id) ? 'Added' : 'Add all'"
                  :icon="modelValue.includes(parent.id) ? 'pi pi-check' : 'pi pi-plus'"
                  size="small"
                  :severity="modelValue.includes(parent.id) ? 'success' : 'secondary'"
                  outlined
                  @click="toggle(parent.id)" />
              </div>
              <!-- Child rows -->
              <template v-if="expandedIds[parent.id]">
                <div v-for="child in parent._children" :key="child.id"
                  class="flex items-center gap-2 px-3 py-2 pl-9 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: child.color ?? '#94a3b8' }" />
                  <span class="flex-1 text-sm text-gray-700">{{ child.name }}</span>
                  <span class="text-xs text-gray-400 mr-1">{{ child._memberCount }}</span>
                  <Button
                    :label="modelValue.includes(child.id) ? 'Added' : 'Add'"
                    :icon="modelValue.includes(child.id) ? 'pi pi-check' : 'pi pi-plus'"
                    size="small"
                    :severity="modelValue.includes(child.id) ? 'success' : 'secondary'"
                    outlined
                    @click="toggle(child.id)" />
                </div>
              </template>
            </template>
          </template>
          <div v-else class="py-6 text-center text-sm text-gray-400">No groups found</div>
        </div>
      </div>

      <!-- Right: selected groups -->
      <div class="p-5 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-gray-800">Selected</p>
          <span v-if="modelValue.length" class="text-xs text-gray-400">
            {{ modelValue.length }} group{{ modelValue.length !== 1 ? 's' : '' }}
          </span>
        </div>
        <div class="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          <div v-if="!modelValue.length" class="py-10 text-center text-sm text-gray-400">
            <i class="pi pi-users text-2xl text-gray-300 block mb-2" />
            No groups selected yet
          </div>
          <div v-else>
            <div v-for="id in modelValue" :key="id"
              class="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 last:border-0">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: groupColor(id) }" />
              <span class="flex-1 text-sm text-gray-700">{{ groupLabel(id) }}</span>
              <button class="text-gray-300 hover:text-red-500 transition-colors" @click="toggle(id)">
                <i class="pi pi-times text-xs" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
const props = defineProps<{
  modelValue: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [string[]]
}>()

const db = useDb()
const search = ref('')
const loading = ref(true)
const allGroupTree = ref<any[]>([])
const expandedIds = reactive<Record<string, boolean>>({})

onMounted(async () => {
  const [{ data: groupData }, { data: membershipData }] = await Promise.all([
    db.from('member_groups').select('id, name, color, parent_id, sort_order').eq('org_id', orgId.value).order('sort_order'),
    db.from('member_group_memberships').select('group_id'),
  ])
  const countMap: Record<string, number> = {}
  for (const m of membershipData ?? []) countMap[m.group_id] = (countMap[m.group_id] ?? 0) + 1
  const groups = (groupData ?? []).map(g => ({ ...g, _memberCount: countMap[g.id] ?? 0 }))
  const children = groups.filter(g => g.parent_id)
  allGroupTree.value = groups
    .filter(g => !g.parent_id)
    .map(parent => ({ ...parent, _children: children.filter(c => c.parent_id === parent.id) }))
  loading.value = false
})

const filteredTree = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return allGroupTree.value
  return allGroupTree.value.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p._children?.some((c: any) => c.name.toLowerCase().includes(q))
  )
})

function groupLabel(id: string): string {
  for (const parent of allGroupTree.value) {
    if (parent.id === id) return parent.name
    const child = parent._children?.find((c: any) => c.id === id)
    if (child) return `${parent.name} › ${child.name}`
  }
  return id
}

function groupColor(id: string): string {
  for (const parent of allGroupTree.value) {
    if (parent.id === id) return parent.color ?? '#94a3b8'
    const child = parent._children?.find((c: any) => c.id === id)
    if (child) return child.color ?? parent.color ?? '#94a3b8'
  }
  return '#94a3b8'
}

function toggle(id: string) {
  const current = [...props.modelValue]
  const idx = current.indexOf(id)
  if (idx >= 0) current.splice(idx, 1)
  else current.push(id)
  emit('update:modelValue', current)
}
</script>
