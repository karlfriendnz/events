<template>
  <!-- Empty state -->
  <div v-if="!modelValue.length"
    class="border-2 border-dashed rounded-xl py-10 text-center transition-all"
    :class="dropActive ? 'border-[#0e43a3] bg-blue-50/30' : 'border-gray-200 bg-[#fafaf9]'"
    @dragover.prevent="onDragOver"
    @dragleave="dropActive = false"
    @drop.prevent="onDrop">
    <i class="pi pi-arrow-circle-down mb-1.5 text-sm" :class="dropActive ? 'text-[#0e43a3]' : 'text-gray-300'" />
    <p class="text-sm font-semibold" :class="dropActive ? 'text-[#0e43a3]' : 'text-gray-400'">
      {{ dropActive ? 'Drop to add field' : (emptyText ?? 'Drag fields here') }}
    </p>
    <slot name="empty-action" />
  </div>

  <!-- Field grid -->
  <div v-else ref="listEl" class="grid grid-cols-2 gap-3"
    @dragover.prevent="onDragOver"
    @dragleave="dropActive = false"
    @drop.prevent="onDrop">
    <div v-for="f in modelValue" :key="f._key"
      :data-field-key="f._key"
      :data-pinned="isPinned(f) ? 'true' : null"
      :class="[
        f.col_span === 1 ? 'col-span-1' : 'col-span-2',
        editingKey === f._key
          ? 'ring-2 ring-[#0e43a3]/40 bg-blue-50/20'
          : 'hover:ring-2 hover:ring-[#0e43a3]/20 hover:bg-blue-50/20',
      ]"
      class="space-y-1 group cursor-pointer rounded-lg px-2 py-1 -mx-2 transition-all relative"
      @click="$emit('select', f._key)">

      <!-- Drag handle (skipped on pinned fields) — floats over top-right -->
      <span v-if="!isPinned(f)"
        class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-[#1E2157] opacity-0 group-hover:opacity-100 transition-opacity z-10"
        v-tooltip.top="'Drag to reorder'"
        @click.stop
        @mousedown.stop>
        <i class="pi pi-arrows-alt text-[11px]" />
      </span>

      <!-- Block: section heading -->
      <template v-if="f.field_type === 'section'">
        <p class="text-sm font-bold text-gray-800">{{ f.label || 'Section heading' }}</p>
        <p v-if="f.placeholder" class="text-xs text-gray-400">{{ f.placeholder }}</p>
      </template>

      <!-- Block: image -->
      <template v-else-if="f.field_type === 'image'">
        <div class="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
          <i class="pi pi-image text-base" />
          <span class="ml-2 text-xs">{{ f.label || 'Image' }}</span>
        </div>
      </template>

      <!-- Block: text -->
      <template v-else-if="f.field_type === 'text-block' || f.field_type === 'text_block'">
        <p class="text-sm text-gray-600 whitespace-pre-wrap">{{ f.label || 'Text block' }}</p>
      </template>

      <!-- Block: button -->
      <template v-else-if="f.field_type === 'button'">
        <span class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1E2157] text-white pointer-events-none">
          {{ f.label || 'Button' }}
          <i class="pi pi-external-link text-xs" />
        </span>
      </template>

      <!-- Regular field -->
      <template v-else>
        <div v-if="f.field_type !== 'checkbox'" class="flex items-center gap-1">
          <label class="text-sm font-semibold text-gray-600 cursor-pointer">
            {{ f.label }}
            <span v-if="f.is_required" class="text-red-400 ml-0.5">*</span>
          </label>
          <i v-if="f.core" class="pi pi-lock text-[9px] text-blue-400 ml-1" v-tooltip.top="'Core booking field'" />
          <i class="pi pi-pencil text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
        </div>
        <textarea v-if="f.field_type === 'textarea' || f.field_type === 'LONG_TEXT'"
          :placeholder="f.has_placeholder ? f.placeholder : ''"
          rows="3"
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none resize-none pointer-events-none" />
        <select v-else-if="f.field_type === 'select' || f.field_type === 'SINGLE_SELECT' || f.field_type === 'MULTI_SELECT'"
          class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none bg-white pointer-events-none">
          <option value="" disabled selected>{{ f.has_placeholder ? f.placeholder : 'Select...' }}</option>
          <option v-for="opt in selectOptions(f)" :key="opt" :value="opt">{{ opt }}</option>
        </select>
        <div v-else-if="f.field_type === 'checkbox' || f.field_type === 'TOGGLE'"
          class="flex items-center gap-2.5 pointer-events-none">
          <input type="checkbox" class="w-4 h-4 rounded border-gray-300 accent-[#1E2157]" />
          <span class="text-sm text-gray-600">{{ f.label }}</span>
        </div>
        <input v-else-if="f.field_type === 'date' || f.field_type === 'DATE'" type="date"
          class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none pointer-events-none" />
        <input v-else-if="f.field_type === 'file' || f.field_type === 'FILE'" type="file"
          class="w-full text-xs text-gray-500 pointer-events-none" />
        <input v-else
          :type="inputType(f)"
          :placeholder="f.has_placeholder ? f.placeholder : ''"
          class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none pointer-events-none" />
        <p v-if="f.has_helper_text && f.helper_text" class="text-xs text-gray-400 mt-0.5">{{ f.helper_text }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sortable from 'sortablejs'

interface CanvasField {
  _key: string
  field_type: string
  label: string
  is_required?: boolean
  placeholder?: string
  has_placeholder?: boolean
  helper_text?: string
  has_helper_text?: boolean
  col_span?: 1 | 2
  _optionsText?: string
  options?: any
  core?: string
}

const props = defineProps<{
  modelValue: CanvasField[]
  editingKey?: string | null
  pinnedRoles?: string[]
  emptyText?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: CanvasField[]): void
  (e: 'select', key: string): void
  (e: 'drop', payload: string): void
}>()

const listEl = ref<HTMLElement | null>(null)
let sortable: any = null
const dropActive = ref(false)

function isPinned(f: CanvasField) {
  return !!(f.core && (props.pinnedRoles ?? []).includes(f.core))
}

function selectOptions(f: CanvasField): string[] {
  if (Array.isArray(f.options)) return f.options
  return (f._optionsText ?? '').split('\n').map(s => s.trim()).filter(Boolean)
}

function inputType(f: CanvasField): string {
  if (f.field_type === 'number' || f.field_type === 'NUMBER') return 'number'
  if (f.field_type === 'email')     return 'email'
  if (f.field_type === 'phone' || f.field_type === 'tel') return 'tel'
  if (f.core === 'email')           return 'email'
  if (f.core === 'phone')           return 'tel'
  return 'text'
}

function onDragOver(e: DragEvent) {
  // Only highlight if there's actually a drag payload (not internal Sortable drags)
  if (e.dataTransfer?.types.includes('text/plain')) {
    dropActive.value = true
    e.dataTransfer.dropEffect = 'copy'
  }
}
function onDrop(e: DragEvent) {
  dropActive.value = false
  const payload = e.dataTransfer?.getData('text/plain')
  if (payload) emit('drop', payload)
}

watch(listEl, (el) => {
  if (sortable) { sortable.destroy(); sortable = null }
  if (!el) return
  sortable = Sortable.create(el, {
    handle: '.field-drag-handle',
    animation: 150,
    filter: '[data-pinned="true"]',
    onMove: (evt: any) => evt.related?.dataset?.pinned !== 'true',
    onEnd: () => {
      const orderedKeys = Array.from(el.querySelectorAll<HTMLElement>('[data-field-key]'))
        .map(n => n.dataset.fieldKey!)
      const next = [...props.modelValue].sort(
        (a, b) => orderedKeys.indexOf(a._key) - orderedKeys.indexOf(b._key),
      )
      // Re-pin fields with a "pinned" core role to the top, in the order
      // they appear in pinnedRoles.
      const pinnedRoles = props.pinnedRoles ?? []
      const pinned = pinnedRoles
        .map(role => next.find(f => f.core === role))
        .filter(Boolean) as CanvasField[]
      const rest = next.filter(f => !pinnedRoles.includes(f.core ?? ''))
      emit('update:modelValue', [...pinned, ...rest])
    },
  })
})
onBeforeUnmount(() => { if (sortable) { sortable.destroy(); sortable = null } })
</script>
