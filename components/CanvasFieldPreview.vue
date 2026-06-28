<!--
  CanvasFieldPreview — the read-only preview of one form field/block, extracted from
  <FormFieldCanvas> so it can be reused by both the flat and the sectioned (drag-into-
  section) canvas layouts. Pure render: the parent owns the selectable/draggable wrapper.
-->
<template>
  <!-- Block: section heading -->
  <template v-if="f.field_type === 'section'">
    <p class="text-sm font-bold text-gray-800">{{ f.label || 'Section heading' }}</p>
    <p v-if="f.placeholder" class="text-xs text-gray-400">{{ f.placeholder }}</p>
  </template>

  <!-- Block: image -->
  <template v-else-if="f.field_type === 'image'">
    <img v-if="f.block && f.block[0]" :src="f.block[0]" class="w-full max-h-40 object-contain rounded-lg" />
    <div v-else class="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
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
    <span class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white pointer-events-none">
      {{ f.label || 'Button' }}
      <i class="pi pi-external-link text-xs" />
    </span>
  </template>

  <!-- Regular field -->
  <template v-else>
    <div v-if="f.field_type !== 'checkbox'" class="flex items-center gap-1">
      <label class="text-xs font-medium text-gray-600 cursor-pointer">
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
      <input type="checkbox" class="w-4 h-4 rounded border-gray-300 accent-primary" />
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
</template>

<script setup lang="ts">
defineProps<{ f: any }>()

function selectOptions(f: any): string[] {
  if (Array.isArray(f.options)) return f.options
  return (f._optionsText ?? '').split('\n').map((s: string) => s.trim()).filter(Boolean)
}
function inputType(f: any): string {
  if (f.field_type === 'number' || f.field_type === 'NUMBER') return 'number'
  if (f.field_type === 'email') return 'email'
  if (f.field_type === 'phone' || f.field_type === 'tel') return 'tel'
  if (f.core === 'email') return 'email'
  if (f.core === 'phone') return 'tel'
  return 'text'
}
</script>
