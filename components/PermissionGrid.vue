<!--
  Reusable permission CHECKLIST — a curated list of explicit, named capabilities
  (PERMISSION_ITEMS) grouped by area, bound to a PermissionMap via v-model. Each
  item toggles its underlying (resource, action) grants, so can() + the
  permission-driven menu keep working. readonly disables editing (used to show an
  inherited core template before a club overrides it).
-->
<script setup lang="ts">
const props = defineProps<{ modelValue: PermissionMap; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [PermissionMap] }>()

const itemsByArea = computed(() =>
  PERM_ITEM_AREAS.map(area => ({ area, items: PERMISSION_ITEMS.filter(i => i.area === area) })))

// Accordion open-state (all collapsed by default).
const open = ref<Record<string, boolean>>({})
function toggleOpen(area: string) { open.value = { ...open.value, [area]: !open.value[area] } }

function isOn(item: PermItem) { return permItemOn(props.modelValue, item) }
function toggle(item: PermItem, on: boolean) {
  if (props.readonly) return
  emit('update:modelValue', setPermItem(props.modelValue, item, on))
}
function grantedCount(items: PermItem[]) { return items.filter(i => isOn(i)).length }
// Split an area's items into their optional sub-groups (order preserved). A
// section with no groups returns a single { group: null } block (flat).
function subGroupsFor(items: PermItem[]) {
  const order: string[] = []; const map: Record<string, PermItem[]> = {}
  for (const it of items) { const g = it.group || ''; if (!(g in map)) { map[g] = []; order.push(g) } map[g].push(it) }
  return order.map(g => ({ group: g || null, items: map[g] }))
}
function areaAllOn(items: PermItem[]) { return items.every(i => isOn(i)) }
function toggleArea(items: PermItem[], on: boolean) {
  if (props.readonly) return
  let p: PermissionMap = props.modelValue || {}
  for (const i of items) p = setPermItem(p, i, on)
  emit('update:modelValue', p)
}
</script>

<template>
  <div class="card p-0 overflow-hidden divide-y divide-gray-100" :class="{ 'opacity-90': readonly }">
    <!-- One accordion panel per section; permissions inside an aligned grid. -->
    <div v-for="block in itemsByArea" :key="block.area">
      <!-- header -->
      <button type="button" class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50/60"
        @click="toggleOpen(block.area)">
        <i class="pi text-xs text-gray-400 transition-transform" :class="open[block.area] ? 'pi-chevron-down' : 'pi-chevron-right'" />
        <span class="text-sm font-semibold text-gray-800 flex-1">{{ block.area }}</span>
        <span class="text-[11px] px-2 py-0.5 rounded-full"
          :class="grantedCount(block.items) ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'">
          {{ grantedCount(block.items) }} / {{ block.items.length }}
        </span>
      </button>
      <!-- body -->
      <div v-show="open[block.area]" class="px-4 pb-4">
        <div class="flex justify-end -mt-1 mb-2">
          <button v-if="!readonly" class="text-[11px] text-gray-400 hover:text-primary"
            @click="toggleArea(block.items, !areaAllOn(block.items))">
            {{ areaAllOn(block.items) ? 'Clear all' : 'Select all' }}
          </button>
        </div>
        <div v-for="sg in subGroupsFor(block.items)" :key="sg.group || 'flat'">
          <div v-if="sg.group" class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-4 first:mt-0 mb-2">{{ sg.group }}</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2.5">
            <label v-for="item in sg.items" :key="item.key"
              class="flex items-start gap-2.5"
              :class="readonly ? 'cursor-default' : 'cursor-pointer'">
              <input type="checkbox" class="mt-0.5 w-4 h-4 accent-primary shrink-0"
                :class="readonly ? 'cursor-not-allowed' : 'cursor-pointer'"
                :checked="isOn(item)" :disabled="readonly"
                @change="toggle(item, ($event.target as HTMLInputElement).checked)" />
              <span class="min-w-0">
                <span class="block text-sm text-gray-700 leading-tight">{{ item.label }}</span>
                <span v-if="item.description" class="block text-[11px] leading-snug text-gray-400 mt-0.5">{{ item.description }}</span>
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
