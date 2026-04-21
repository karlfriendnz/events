<template>
  <div class="space-y-3">
    <div v-for="(loc, locIdx) in modelValue" :key="locIdx" class="border border-gray-200 rounded-xl p-3 space-y-3">
      <div v-if="modelValue.length > 1" class="flex items-center justify-between">
        <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Location {{ locIdx + 1 }}</span>
        <button class="text-xs text-red-500 hover:text-red-700" @click="remove(locIdx)">Remove</button>
      </div>

      <!-- Type selector -->
      <div class="grid grid-cols-3 gap-3">
        <div v-for="lt in locationTypes" :key="lt.value"
          class="border-2 rounded-xl p-3 cursor-pointer flex flex-col items-center gap-2 transition-colors"
          :class="loc.type === lt.value ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'"
          @click="setType(locIdx, lt.value as LocationEntry['type'])">
          <i :class="`pi ${lt.icon} text-xl`" :style="loc.type === lt.value ? 'color:#1D4ED8' : 'color:#9ca3af'" />
          <span class="text-xs font-medium" :class="loc.type === lt.value ? 'text-blue-700' : 'text-gray-600'">{{ lt.label }}</span>
        </div>
      </div>

      <!-- ADDRESS -->
      <template v-if="loc.type === 'ADDRESS'">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Venue Name</label>
          <InputText :value="loc.venue_name" placeholder="e.g. City Aquatic Centre" class="w-full"
            @input="setField(locIdx, 'venue_name', ($event.target as HTMLInputElement).value)" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Address</label>
          <InputText :value="loc.address" placeholder="Street address, suburb, state" class="w-full"
            @input="setField(locIdx, 'address', ($event.target as HTMLInputElement).value)" />
        </div>
      </template>

      <!-- ONLINE -->
      <div v-else-if="loc.type === 'ONLINE'" class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-gray-700">Meeting Link</label>
        <InputText :value="loc.meeting_link" placeholder="https://zoom.us/j/..." class="w-full"
          @input="setField(locIdx, 'meeting_link', ($event.target as HTMLInputElement).value)" />
      </div>

      <!-- BOOKABLE -->
      <div v-else-if="loc.type === 'BOOKABLE'" class="border border-gray-200 rounded-xl overflow-hidden">
        <slot name="bookable-header" />
        <div v-if="checkingAvailability" class="px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5 text-xs text-gray-400">
          <i class="pi pi-spin pi-spinner text-[10px]" /> Checking availability…
        </div>
        <div v-if="bookablesLoading" class="py-6 flex justify-center">
          <i class="pi pi-spin pi-spinner text-gray-400" />
        </div>
        <div v-else-if="flatVenueTree.length === 0" class="py-6 text-center text-sm text-gray-400">
          No venues yet.
        </div>
        <div v-else>
          <template v-for="node in flatVenueTree" :key="node.id">
            <!-- Venue row -->
            <div
              class="flex items-center gap-2 py-2.5 border-b border-gray-100 cursor-pointer transition-colors"
              :class="effectiveAvailabilityMap[node.id] === 'booked' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'"
              :style="{ paddingLeft: `${12 + node._depth * 20}px`, paddingRight: '12px' }"
              @click="effectiveAvailabilityMap[node.id] !== 'booked' && toggleVenue(locIdx, node.id)">
              <button v-if="node._hasChildren"
                class="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-700 shrink-0"
                @click.stop="toggleExpand(node.id)">
                <i :class="`pi text-xs ${expandedIds[node.id] ? 'pi-chevron-down' : 'pi-chevron-right'}`" />
              </button>
              <div v-else class="w-4 shrink-0" />
              <span
                class="inline-flex items-center justify-center w-[18px] h-[18px] rounded border-2 shrink-0 transition-colors cursor-pointer"
                :class="loc.bookable_ids.includes(node.id) || isPartial(loc, node.id)
                  ? 'bg-[#1E2157] border-[#1E2157]'
                  : 'border-gray-400 bg-white hover:border-[#1E2157]'"
                @click.stop="effectiveAvailabilityMap[node.id] !== 'booked' && toggleVenue(locIdx, node.id)">
                <i v-if="loc.bookable_ids.includes(node.id)" class="pi pi-check text-white" style="font-size:10px" />
                <span v-else-if="isPartial(loc, node.id)" class="block w-2 h-0.5 bg-white rounded-full" />
              </span>
              <span class="flex-1 text-sm"
                :class="node._depth === 0 ? 'font-semibold text-gray-800' : 'text-gray-700'"
                @click.stop="effectiveAvailabilityMap[node.id] !== 'booked' && toggleVenue(locIdx, node.id)">{{ node.name }}</span>
              <span v-if="effectiveAvailabilityMap[node.id]"
                class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                :class="effectiveAvailabilityMap[node.id] === 'available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'">
                {{ effectiveAvailabilityMap[node.id] === 'available' ? 'Available' : 'Booked' }}
              </span>
            </div>
            <!-- Layout radio rows (shown when node is selected and has layouts) -->
            <template v-if="loc.bookable_ids.includes(node.id) && node.layouts?.length">
              <div v-for="layout in node.layouts" :key="layout"
                class="flex items-center gap-2.5 py-2 border-b border-gray-100 bg-gray-50/60 cursor-pointer hover:bg-blue-50/40 transition-colors"
                :style="{ paddingLeft: `${12 + (node._depth + 1) * 20}px`, paddingRight: '12px' }"
                @click="setLayout(locIdx, node.id, layout)">
                <!-- Radio button -->
                <span class="w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
                  :class="(loc.bookable_layouts ?? {})[node.id] === layout
                    ? 'border-[#1E2157] bg-[#1E2157]'
                    : 'border-gray-400 bg-white'">
                  <span v-if="(loc.bookable_layouts ?? {})[node.id] === layout" class="w-2 h-2 rounded-full bg-white" />
                </span>
                <span class="text-sm text-gray-700">{{ layout }}</span>
                <span v-if="effectiveAvailabilityMap[node.id]"
                  class="ml-auto text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  :class="effectiveAvailabilityMap[node.id] === 'available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'">
                  {{ effectiveAvailabilityMap[node.id] === 'available' ? 'Available' : 'Booked' }}
                </span>
              </div>
            </template>
          </template>
        </div>
      </div>
    </div>

    <Button v-if="multi" label="Add another location" icon="pi pi-plus" severity="secondary" outlined size="small" @click="add" />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import type { LocationEntry } from '~/composables/useLocation'

const props = withDefaults(defineProps<{
  modelValue: LocationEntry[]
  multi?: boolean
  availabilityMap?: Record<string, 'available' | 'booked'>
  startAt?: string | null
  endAt?: string | null
  excludeEventId?: string | null
}>(), {
  multi: true,
  startAt: null,
  endAt: null,
  excludeEventId: null,
})

const emit = defineEmits<{
  'update:modelValue': [LocationEntry[]]
  'update:summary': [string]
}>()

const locationTypes = [
  { value: 'ADDRESS', label: 'Address', icon: 'pi-map-marker' },
  { value: 'BOOKABLE', label: 'Venue', icon: 'pi-building' },
  { value: 'ONLINE', label: 'Online', icon: 'pi-video' },
]

// ---- Bookables ----
const db = useDb()
const allBookables = ref<any[]>([])
const bookablesLoading = ref(false)
const expandedIds = reactive<Record<string, boolean>>({})

onMounted(async () => {
  bookablesLoading.value = true
  const { data, error } = await db.from('bookables')
    .select('id, name, location, parent_id, layouts')
    .eq('org_id', orgId.value)
    .eq('type', 'VENUE')
    .eq('status', 'ACTIVE')
    .order('name')
  if (error) {
    const { data: fallback } = await db.from('bookables')
      .select('id, name, location, parent_id')
      .eq('org_id', orgId.value)
      .eq('type', 'VENUE')
      .eq('status', 'ACTIVE')
      .order('name')
    allBookables.value = fallback ?? []
  } else {
    allBookables.value = data ?? []
  }
  bookablesLoading.value = false
  initExpanded()
  if (hasBookableLocation.value) fetchAvailability()
})

function initExpanded() {
  const selectedIds = props.modelValue
    .filter(l => l.type === 'BOOKABLE')
    .flatMap(l => l.bookable_ids ?? [])
  for (const sid of selectedIds) {
    let node = allBookables.value.find(b => b.id === sid)
    while (node?.parent_id) {
      expandedIds[node.parent_id] = true
      node = allBookables.value.find(b => b.id === node.parent_id)
    }
  }
}

watch(() => props.modelValue, initExpanded, { deep: false })

// ---- Availability ----
const internalAvailabilityMap = ref<Record<string, 'available' | 'booked'>>({})
const checkingAvailability = ref(false)

const hasBookableLocation = computed(() =>
  props.modelValue.some(l => l.type === 'BOOKABLE')
)

const effectiveAvailabilityMap = computed(() =>
  props.availabilityMap ?? internalAvailabilityMap.value
)

async function fetchAvailability() {
  if (!props.startAt || !props.endAt) return
  checkingAvailability.value = true
  try {
    let q = db.from('bookings')
      .select('bookable_id')
      .eq('status', 'CONFIRMED')
      .lt('start_at', props.endAt)
      .gt('end_at', props.startAt)
    if (props.excludeEventId) q = q.neq('event_id', props.excludeEventId)
    const { data } = await q
    const bookedIds = new Set((data ?? []).map((b: any) => b.bookable_id))
    const map: Record<string, 'available' | 'booked'> = {}
    for (const b of allBookables.value) {
      map[b.id] = bookedIds.has(b.id) ? 'booked' : 'available'
    }
    internalAvailabilityMap.value = map
  } finally {
    checkingAvailability.value = false
  }
}

watch([() => props.startAt, () => props.endAt], () => {
  if (hasBookableLocation.value) fetchAvailability()
})

watch(hasBookableLocation, (val) => {
  if (val && Object.keys(internalAvailabilityMap.value).length === 0) fetchAvailability()
})

function buildVenueNodes(parentId: string | null, depth: number): any[] {
  return allBookables.value.filter(b => b.parent_id === parentId).map(b => {
    const kids = buildVenueNodes(b.id, depth + 1)
    return { ...b, _depth: depth, _hasChildren: kids.length > 0, _children: kids }
  })
}

function flattenVenueNodes(nodes: any[]): any[] {
  const result: any[] = []
  for (const node of nodes) {
    result.push(node)
    if (expandedIds[node.id] && node._hasChildren) result.push(...flattenVenueNodes(node._children))
  }
  return result
}

const flatVenueTree = computed(() => flattenVenueNodes(buildVenueNodes(null, 0)))

const richSummary = computed(() => {
  const locs = props.modelValue
  if (!locs || !locs.length) return 'No location'
  return locs.map(loc => {
    if (loc.type === 'ADDRESS') {
      return [loc.venue_name, loc.address].filter(Boolean).join(', ') || 'No location'
    }
    if (loc.type === 'ONLINE') return loc.meeting_link || 'Online'
    if (loc.type === 'BOOKABLE') {
      if (!loc.bookable_ids.length) return 'Venue'
      const names = loc.bookable_ids
        .map(id => allBookables.value.find(b => b.id === id)?.name)
        .filter(Boolean)
      return names.length ? names.join(', ') : 'Venue'
    }
    return 'No location'
  }).join(' · ')
})

watch(richSummary, val => emit('update:summary', val), { immediate: true })

function toggleExpand(id: string) {
  expandedIds[id] = !expandedIds[id]
}

function hasAnyDescendantSelected(loc: LocationEntry, nodeId: string): boolean {
  const children = allBookables.value.filter(b => b.parent_id === nodeId)
  for (const child of children) {
    if (loc.bookable_ids.includes(child.id)) return true
    if (hasAnyDescendantSelected(loc, child.id)) return true
  }
  return false
}

function isPartial(loc: LocationEntry, nodeId: string): boolean {
  if (loc.bookable_ids.includes(nodeId)) return false
  return hasAnyDescendantSelected(loc, nodeId)
}

function addDescendants(ids: string[], nodeId: string) {
  const children = allBookables.value.filter(b => b.parent_id === nodeId)
  for (const child of children) {
    if (!ids.includes(child.id)) ids.push(child.id)
    addDescendants(ids, child.id)
    expandedIds[child.id] = true
  }
}

function removeDescendants(ids: string[], nodeId: string) {
  const children = allBookables.value.filter(b => b.parent_id === nodeId)
  for (const child of children) {
    const ci = ids.indexOf(child.id)
    if (ci !== -1) ids.splice(ci, 1)
    removeDescendants(ids, child.id)
  }
}

function toggleVenue(locIdx: number, nodeId: string) {
  const locs = cloneLocations()
  const loc = locs[locIdx]
  const i = loc.bookable_ids.indexOf(nodeId)
  if (i === -1) {
    loc.bookable_ids.push(nodeId)
    addDescendants(loc.bookable_ids, nodeId)
    expandedIds[nodeId] = true
  } else {
    loc.bookable_ids.splice(i, 1)
    removeDescendants(loc.bookable_ids, nodeId)
    // Clear layout selection when deselected
    if (loc.bookable_layouts) delete loc.bookable_layouts[nodeId]
  }
  emit('update:modelValue', locs)
}

// ---- Mutations ----
function cloneLocations(): LocationEntry[] {
  return props.modelValue.map(l => ({ ...l, bookable_ids: [...l.bookable_ids], bookable_layouts: { ...(l.bookable_layouts ?? {}) } }))
}

function setLayout(locIdx: number, bookableId: string, layout: string) {
  const locs = cloneLocations()
  if (!locs[locIdx].bookable_layouts) locs[locIdx].bookable_layouts = {}
  locs[locIdx].bookable_layouts![bookableId] = layout
  emit('update:modelValue', locs)
}

function setType(locIdx: number, type: LocationEntry['type']) {
  const locs = cloneLocations()
  locs[locIdx].type = type
  emit('update:modelValue', locs)
}

function setField(locIdx: number, field: keyof LocationEntry, value: string) {
  const locs = cloneLocations()
  ;(locs[locIdx] as any)[field] = value
  emit('update:modelValue', locs)
}

function remove(locIdx: number) {
  const locs = cloneLocations()
  locs.splice(locIdx, 1)
  emit('update:modelValue', locs)
}

function add() {
  const locs = cloneLocations()
  locs.push({ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] })
  emit('update:modelValue', locs)
}
</script>
