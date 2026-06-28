<!--
  One editable field in <FormRenderer>. Renders a real, fillable input per
  field_type (the live counterpart to EvtFieldCell, which is preview-only /
  pointer-events-none). Emits `update` with the new value; the parent owns state.
  Element types (section/image/textblock/button) are handled by the parent — this
  component only renders data fields.
-->
<script setup lang="ts">
const props = defineProps<{ field: any; value: any }>()
const emit = defineEmits<{ (e: 'update', v: any): void }>()
const f = computed(() => props.field)
const colSpan = computed(() => (f.value.col_span === 2 ? 'sm:col-span-2' : 'col-span-1'))
function on(e: Event) { emit('update', (e.target as any).value) }
const inputClass = 'w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary transition-colors'
</script>

<template>
  <div :class="colSpan" class="space-y-1">
    <!-- Checkbox: label sits inline -->
    <label v-if="f.field_type === 'checkbox'" class="flex items-center gap-2.5 cursor-pointer py-1.5">
      <input type="checkbox" class="w-4 h-4 rounded border-gray-300 accent-primary"
        :checked="!!value" @change="emit('update', ($event.target as any).checked)" />
      <span class="text-sm text-gray-700">{{ f.placeholder || f.label }}<span v-if="f.is_required" class="text-red-400 ml-0.5">*</span></span>
    </label>

    <template v-else>
      <label class="text-sm font-semibold text-gray-600">
        {{ f.label }}<span v-if="f.is_required" class="text-red-400 ml-0.5">*</span>
      </label>

      <textarea v-if="f.field_type === 'textarea'" :value="value" rows="3" :placeholder="f.placeholder || ''"
        :class="inputClass" class="!h-auto py-2 resize-none" @input="on" />

      <select v-else-if="f.field_type === 'select'" :value="value" :class="inputClass"
        style="-webkit-appearance:auto;appearance:auto;background:white;" @change="on">
        <option value="" disabled :selected="!value">{{ f.placeholder || 'Select…' }}</option>
        <option v-for="opt in (f.options ?? [])" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <select v-else-if="f.field_type === 'multiselect'" :value="value" :class="inputClass"
        style="-webkit-appearance:auto;appearance:auto;background:white;" @change="on">
        <option value="" disabled :selected="!value">{{ f.placeholder || 'Select…' }}</option>
        <option v-for="opt in (f.options ?? [])" :key="opt" :value="opt">{{ opt }}</option>
      </select>

      <input v-else-if="f.field_type === 'date'" type="date" :value="value" :class="inputClass" @input="on" />

      <input v-else-if="f.field_type === 'color'" type="color" :value="value || '#1E2157'"
        class="h-9 w-16 rounded-lg border border-gray-200 cursor-pointer" @input="on" />

      <input v-else-if="f.field_type === 'file'" type="file"
        class="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm file:font-semibold"
        @change="emit('update', ($event.target as any).files?.[0]?.name || '')" />

      <!-- text / email / tel / number -->
      <input v-else :type="['email','tel','number'].includes(f.field_type) ? f.field_type : 'text'"
        :value="value" :placeholder="f.placeholder || ''" :class="inputClass" @input="on" />

      <p v-if="f.has_helper_text && f.helper_text" class="text-[11px] text-gray-400">{{ f.helper_text }}</p>
    </template>
  </div>
</template>
