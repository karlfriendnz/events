<!--
  Reusable CRUD permission matrix (resources × Create/Read/Update/Delete),
  bound to a PermissionMap via v-model. readonly disables editing (used to show
  an inherited core template before a club overrides it).
-->
<script setup lang="ts">
const props = defineProps<{ modelValue: PermissionMap; readonly?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [PermissionMap] }>()

const resourcesByArea = computed(() =>
  PERMISSION_AREAS.map(area => ({ area, items: PERMISSION_RESOURCES.filter(r => r.area === area) })))

function isOn(res: string, action: PermAction) { return !!props.modelValue?.[res]?.[action] }
function emitWith(mut: (p: PermissionMap) => void) {
  if (props.readonly) return
  const p: PermissionMap = JSON.parse(JSON.stringify(props.modelValue || {}))
  mut(p); emit('update:modelValue', p)
}
function setOn(res: string, action: PermAction, val: boolean) {
  emitWith(p => { p[res] = { ...(p[res] || {}), [action]: val } })
}
function toggleResource(res: string, val: boolean) {
  const r = PERMISSION_RESOURCES.find(x => x.key === res); if (!r) return
  emitWith(p => { for (const a of resourceActions(r)) p[res] = { ...(p[res] || {}), [a]: val } })
}
function toggleColumn(action: PermAction, val: boolean) {
  emitWith(p => { for (const r of PERMISSION_RESOURCES) if (resourceActions(r).includes(action)) p[r.key] = { ...(p[r.key] || {}), [action]: val } })
}
</script>

<template>
  <div class="card p-0 overflow-hidden" :class="{ 'opacity-90': readonly }">
    <table class="w-full text-sm">
      <thead>
        <tr class="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
          <th class="text-left px-4 py-2 font-medium">Function</th>
          <th v-for="a in PERM_ACTIONS" :key="a.key" class="px-3 py-2 font-medium text-center w-20">
            <div class="flex flex-col items-center gap-0.5">
              <span>{{ a.label }}</span>
              <button v-if="!readonly" class="text-[10px] text-gray-400 hover:text-[#1E2157]" @click="toggleColumn(a.key, true)">all</button>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="block in resourcesByArea" :key="block.area">
          <tr class="bg-gray-50/60">
            <td :colspan="PERM_ACTIONS.length + 1" class="px-4 py-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{{ block.area }}</td>
          </tr>
          <tr v-for="r in block.items" :key="r.key" class="border-b border-gray-50 hover:bg-gray-50/60">
            <td class="px-4 py-2">
              <button class="text-gray-800 hover:text-[#1E2157] font-medium" :disabled="readonly"
                @click="toggleResource(r.key, !isOn(r.key, 'read'))">{{ r.label }}</button>
            </td>
            <td v-for="a in PERM_ACTIONS" :key="a.key" class="px-3 py-2 text-center">
              <input type="checkbox" class="w-4 h-4 accent-[#1E2157]" :class="readonly ? 'cursor-not-allowed' : 'cursor-pointer'"
                :checked="isOn(r.key, a.key)" :disabled="readonly"
                @change="setOn(r.key, a.key, ($event.target as HTMLInputElement).checked)" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
