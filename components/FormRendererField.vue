<!--
  One item in <FormRenderer>. Renders a real, fillable input per field_type (the
  live counterpart to EvtFieldCell, which is preview-only / pointer-events-none),
  AND the presentational layout blocks a designer can drop into a subject —
  image / textblock / button (their content lives in `options[0..2]`, mirroring
  EvtFieldCell). Emits `update` with the new value for data fields; the parent owns
  state. Section blocks are still handled by the parent (they hold child fields).
-->
<script setup lang="ts">
const props = defineProps<{
  field: any; value: any
  /** For the comms field: who this subject can receive updates for, the club's topics,
   *  and this subject's name — all supplied by the host <FormRenderer>. */
  commsPeople?: { id: string; label: string }[]
  commsTopics?: { id: string; name: string; channels: string[] }[]
  subjectLabel?: string
  /** Builder edit mode: inputs are inert so a click opens the field editor instead of
   *  typing. account/comms stay interactive (they handle their own clicks). */
  editable?: boolean
}>()
const emit = defineEmits<{ (e: 'update', v: any): void; (e: 'edit'): void }>()
const f = computed(() => props.field)
// Builder: a click anywhere on the field (that isn't an interactive control) opens its
// editor. Guarded so the live form never fires it.
function onEditClick() { if (props.editable) emit('edit') }
const colSpan = computed(() => (f.value.col_span === 2 ? 'col-span-full' : 'col-span-1'))
function on(e: Event) { emit('update', (e.target as any).value) }

// Multi-select: value is an array of chosen options; toggle keeps it an array.
function isMultiSelected(opt: string) { return Array.isArray(props.value) && props.value.includes(opt) }
function toggleMulti(opt: string, checked: boolean) {
  const cur = Array.isArray(props.value) ? [...props.value] : []
  const i = cur.indexOf(opt)
  if (checked && i === -1) cur.push(opt)
  if (!checked && i !== -1) cur.splice(i, 1)
  emit('update', cur)
}

// Button block: only allow safe schemes for the href (club-authored, but guard anyway).
const buttonHref = computed(() => {
  const h = String(f.value.options?.[1] ?? '').trim()
  return /^(https?:|mailto:|\/)/i.test(h) ? h : ''
})

// Explicit bg + text + placeholder colours: these inputs render on public pages
// with designed backgrounds (and under OS dark mode), so they must not inherit.
const inputClass = computed(() => 'w-full h-9 px-3 text-sm bg-white text-gray-900 placeholder:text-gray-400 border border-gray-200 rounded-lg outline-none focus:border-primary transition-colors' + (props.editable ? ' pointer-events-none' : ''))
// In edit mode, non-text inputs (checkbox/select/date/…) are inert too so a click hits
// the wrapper and opens the field editor. account/comms are excluded (interactive).
const inert = computed(() => (props.editable ? 'pointer-events-none' : ''))
</script>

<template>
  <!-- ── Layout blocks (presentational — no value, no label) ── -->
  <!-- Image -->
  <div v-if="f.field_type === 'image'" class="col-span-full" :class="['text-' + (f.options?.[2] ?? 'center'), editable ? 'group relative cursor-pointer rounded-lg hover:ring-2 hover:ring-primary/20 transition-all' : '']" @click="onEditClick">
    <img v-if="f.options?.[0]" :src="f.options[0]" :alt="f.options?.[1] || ''" class="max-w-full rounded-lg inline-block" />
    <div v-else-if="editable" class="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300"><i class="pi pi-image text-sm" /></div>
  </div>

  <!-- Text block -->
  <div v-else-if="f.field_type === 'textblock'" class="col-span-full" :class="editable ? 'group relative cursor-pointer rounded-lg -mx-2 px-2 hover:bg-blue-50/40 transition-colors' : ''" @click="onEditClick">
    <p class="text-gray-600 whitespace-pre-wrap" :class="'text-' + (f.options?.[1] ?? 'base')">{{ f.options?.[0] || (editable ? 'Text block' : '') }}</p>
  </div>

  <!-- Button -->
  <div v-else-if="f.field_type === 'button'" class="col-span-full" :class="editable ? 'group relative cursor-pointer' : ''" @click="onEditClick">
    <component :is="editable ? 'span' : (buttonHref ? 'a' : 'span')" :href="editable ? undefined : (buttonHref || undefined)"
      :target="buttonHref ? '_blank' : undefined" :rel="buttonHref ? 'noopener noreferrer nofollow' : undefined"
      class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
      :class="f.options?.[2] === 'secondary' ? 'border border-primary text-primary' : f.options?.[2] === 'link' ? 'text-primary underline' : 'bg-primary text-white'">
      {{ f.options?.[0] || 'Button' }}<i v-if="buttonHref" class="pi pi-external-link text-sm" />
    </component>
  </div>

  <!-- ── Data fields ── -->
  <div v-else :class="[colSpan, editable ? 'group relative cursor-pointer rounded-lg -mx-2 px-2 py-1 border border-transparent hover:border-gray-200 hover:bg-gray-50/70 transition-colors' : '']"
    class="space-y-1" :data-field-id="editable ? f.id : undefined" :data-pinned="editable && f.pinned ? '1' : undefined" @click="onEditClick">
    <!-- Edit affordances (builder only) — pinned name fields aren't draggable. -->
    <span v-if="editable && !f.pinned" class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10" @click.stop @mousedown.stop>
      <i class="pi pi-arrows-alt text-[11px]" />
    </span>
    <i v-if="editable" class="pi pi-pencil absolute top-1 right-6 text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    <!-- Checkbox: label above (like every other field), then the box + its own text -->
    <template v-if="f.field_type === 'checkbox'">
      <label class="text-sm font-semibold text-gray-600">
        {{ f.label }}<span v-if="f.is_required" class="text-red-400 ml-0.5">*</span>
      </label>
      <label class="flex items-start gap-2.5 cursor-pointer py-1">
        <input type="checkbox" class="w-4 h-4 mt-0.5 rounded border-gray-300 accent-primary" :class="inert"
          :checked="!!value" @change="emit('update', ($event.target as any).checked)" />
        <span class="text-sm text-gray-700">{{ f.checkbox_text || f.placeholder || 'Yes' }}</span>
      </label>
    </template>

    <template v-else>
      <!-- account/comms say what they are inline, so the header label would just repeat it -->
      <label v-if="!['account','comms'].includes(f.field_type)" class="text-sm font-semibold text-gray-600">
        {{ f.label }}<span v-if="f.is_required" class="text-red-400 ml-0.5">*</span>
      </label>

      <!-- Account ("Create a login") — a yes/no toggle, not a text box -->
      <div v-if="f.field_type === 'account'" class="space-y-1" @click.stop>
        <label class="flex items-center justify-between gap-3 py-0.5 cursor-pointer">
          <span class="text-sm text-gray-700">Create a login</span>
          <ToggleSwitch :modelValue="!!value" @update:modelValue="v => emit('update', v)" />
        </label>
        <p class="text-[11px] text-gray-400">They can sign in to manage this registration and save time next visit.</p>
      </div>

      <!-- Communication preferences — the shared per-person picker + Customise matrix
           (same control the builder shows). -->
      <CommsPreferences v-else-if="f.field_type === 'comms'"
        :subject-name="subjectLabel" :people="commsPeople ?? []" :topics="commsTopics ?? []"
        :model-value="(value && typeof value === 'object') ? value : {}"
        @update:model-value="v => emit('update', v)" />

      <textarea v-else-if="f.field_type === 'textarea'" :value="value" rows="3" :placeholder="f.placeholder || ''"
        :class="inputClass" class="!h-auto py-2 resize-none" @input="on" />

      <select v-else-if="f.field_type === 'select'" :value="value" :class="[inputClass, !value && 'text-gray-400']"
        style="-webkit-appearance:auto;appearance:auto;background:white;" @change="on">
        <option value="" disabled :selected="!value">{{ f.placeholder || 'Select…' }}</option>
        <option v-for="opt in (f.options ?? [])" :key="opt" :value="opt" class="text-gray-900">{{ opt }}</option>
      </select>

      <!-- Multi-select: real multi-choice (pick any number) rendered as checkboxes -->
      <div v-else-if="f.field_type === 'multiselect'" class="space-y-1.5 pt-0.5" :class="inert">
        <label v-for="opt in (f.options ?? [])" :key="opt" class="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" class="w-4 h-4 rounded border-gray-300 accent-primary"
            :checked="isMultiSelected(opt)" @change="toggleMulti(opt, ($event.target as any).checked)" />
          <span class="text-sm text-gray-700">{{ opt }}</span>
        </label>
        <p v-if="!(f.options ?? []).length" class="text-xs text-gray-400">No options configured.</p>
      </div>

      <input v-else-if="f.field_type === 'date'" type="date" :value="value" :class="inputClass" @input="on" />

      <input v-else-if="f.field_type === 'color'" type="color" :value="value || '#1E2157'"
        class="h-9 w-16 rounded-lg border border-gray-200 cursor-pointer" :class="inert" @input="on" />

      <input v-else-if="f.field_type === 'file'" type="file" :class="inert"
        class="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-100 file:text-sm file:font-semibold"
        @change="emit('update', ($event.target as any).files?.[0]?.name || '')" />

      <!-- text / email / tel / number -->
      <input v-else :type="['email','tel','number'].includes(f.field_type) ? f.field_type : 'text'"
        :value="value" :placeholder="f.placeholder || ''" :class="inputClass" @input="on" />

      <p v-if="f.has_helper_text && f.helper_text" class="text-[11px] text-gray-400">{{ f.helper_text }}</p>
    </template>
  </div>
</template>
