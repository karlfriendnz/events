<!--
  One field/element cell in the events form preview. Rendered both at the top level
  and inside a section holder, so it lives in a component to avoid duplication.
  All page state is reached through an injected `evtFieldCtx` using getter/setter
  accessors (no v-model on injected refs). Sections are NOT rendered here — the page
  renders them as left-label / right-fields holders.

  Two modes, driven by `ctx.isPreview()`:
   • BUILD (default) — inputs are inert (`pointer-events-none`), each cell has a
     click-to-edit hover ring + drag handle + pencil; clicking opens the editor.
   • PREVIEW ("how registrants see this form") — inputs are LIVE and fillable, and
     all edit affordances (hover ring, drag handle, pencil, click-to-edit) are gone.
-->
<script setup lang="ts">
const props = defineProps<{ field: any; subjectKey: string; inst: number }>()
const ctx = inject<any>('evtFieldCtx')!

// Live + fillable in the dedicated preview; inert/editable-on-click while building.
const interactive = computed(() => !!ctx.isPreview?.())
const readOnly = computed(() => ctx.coreReadOnly(props.subjectKey, props.inst, props.field))
function get() { return ctx.getVal(props.subjectKey, props.inst, props.field.label) }
function set(v: any) { ctx.setVal(props.subjectKey, props.inst, props.field.label, v) }
// In build mode, clicking a cell opens its editor; in preview, do nothing.
function edit() { if (!interactive.value) ctx.openEditor(props.field.id) }
// Input pointer-events: inert while building so the cell click hits the editor.
const inert = computed(() => (interactive.value ? '' : 'pointer-events-none'))
</script>

<template>
  <!-- Image element -->
  <div v-if="field.field_type === 'image'"
    :data-field-key="field.id"
    class="group relative rounded-lg transition-all"
    :class="[interactive ? '' : 'cursor-pointer hover:ring-2 hover:ring-[#0e43a3]/30', 'col-span-2', 'text-' + (field.options?.[2] ?? 'center')]"
    @click="edit">
    <span v-if="!interactive" class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10" v-tooltip.top="'Drag to reorder'" @click.stop @mousedown.stop>
      <i class="pi pi-arrows-alt text-[11px]" />
    </span>
    <img v-if="field.options?.[0]" :src="field.options[0]" :alt="field.options[1]" class="max-w-full rounded-lg inline-block" />
    <div v-else class="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300"><i class="pi pi-image text-sm" /></div>
    <i v-if="!interactive" class="pi pi-pencil absolute top-2 right-2 text-sm text-gray-400 bg-white rounded shadow px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>

  <!-- Text block element -->
  <div v-else-if="field.field_type === 'textblock'"
    :data-field-key="field.id"
    class="col-span-2 group relative rounded-lg px-2 -mx-2 transition-colors"
    :class="interactive ? '' : 'cursor-pointer hover:bg-blue-50/40'"
    @click="edit">
    <span v-if="!interactive" class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10" v-tooltip.top="'Drag to reorder'" @click.stop @mousedown.stop>
      <i class="pi pi-arrows-alt text-[11px]" />
    </span>
    <p class="text-gray-600 whitespace-pre-wrap" :class="'text-' + (field.options?.[1] ?? 'base')">{{ field.options?.[0] || 'Text block' }}</p>
    <i v-if="!interactive" class="pi pi-pencil absolute top-1 right-2 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>

  <!-- Button element -->
  <div v-else-if="field.field_type === 'button'"
    :data-field-key="field.id"
    class="col-span-2 group relative"
    :class="interactive ? '' : 'cursor-pointer'"
    @click="edit">
    <span v-if="!interactive" class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10" v-tooltip.top="'Drag to reorder'" @click.stop @mousedown.stop>
      <i class="pi pi-arrows-alt text-[11px]" />
    </span>
    <span class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors pointer-events-none"
      :class="field.options?.[2] === 'secondary' ? 'border border-primary text-primary' : field.options?.[2] === 'link' ? 'text-[#0e43a3] underline' : 'bg-primary text-white'">
      {{ field.options?.[0] || 'Button' }}<i class="pi pi-external-link text-sm" />
    </span>
    <i v-if="!interactive" class="pi pi-pencil absolute top-1 right-0 text-[10px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>

  <!-- Regular data field -->
  <div v-else
    :data-field-key="field.id"
    :class="[field.col_span === 2 ? 'col-span-2' : '', interactive ? '' : 'cursor-pointer hover:ring-2 hover:ring-[#0e43a3]/20 hover:bg-blue-50/20']"
    class="space-y-1 group rounded-lg px-2 -mx-2 transition-all relative"
    @click="edit">
    <span v-if="!interactive" class="field-drag-handle absolute right-0 top-0 w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity z-10" v-tooltip.top="'Drag to reorder'" @click.stop @mousedown.stop>
      <i class="pi pi-arrows-alt text-[11px]" />
    </span>
    <!-- Label (hidden for checkboxes — text is inline) -->
    <div v-if="field.field_type !== 'checkbox'" class="flex items-center gap-1" :class="interactive ? '' : 'cursor-pointer'" @click="edit">
      <label class="text-sm font-semibold text-gray-600" :class="interactive ? '' : 'cursor-pointer'">{{ field.label }}<span v-if="field.is_required" class="text-red-400 ml-0.5">*</span></label>
      <span v-if="readOnly" class="text-[10px] font-normal text-gray-400 inline-flex items-center gap-0.5"><i class="pi pi-lock text-[9px]" />from your account</span>
      <i v-if="!interactive" class="pi pi-pencil text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
    </div>
    <!-- Core account field, primary registrant in preview: pre-filled + read-only -->
    <input v-if="readOnly" type="text" readonly :value="ctx.previewAccount[field.account]"
      class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-gray-100 text-gray-500 outline-none" />
    <textarea v-else-if="field.field_type === 'textarea'" :value="get()" @input="set(($event.target as any).value)" :placeholder="field.placeholder || ''" rows="3"
      class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none transition-colors resize-none" :class="inert" @click.stop />
    <select v-else-if="field.field_type === 'select'" :value="get()" @change="set(($event.target as any).value)"
      class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none transition-colors bg-white" :class="inert"
      :style="interactive ? '-webkit-appearance:auto;appearance:auto;' : ''" @click.stop>
      <option :value="undefined" disabled>{{ field.placeholder || 'Select...' }}</option>
      <option v-for="opt in (field.options ?? [])" :key="opt" :value="opt">{{ opt }}</option>
    </select>
    <div v-else-if="field.field_type === 'multiselect'" class="flex items-center justify-between gap-2 w-full h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-400 pointer-events-none">
      <span class="truncate">{{ field.placeholder || 'Select one or more…' }}</span><i class="pi pi-chevron-down text-[10px]" />
    </div>
    <div v-else-if="field.field_type === 'checkbox'" class="flex items-center gap-2.5">
      <input type="checkbox" :checked="!!get()" @change="set(($event.target as any).checked)" class="w-4 h-4 rounded border-gray-300 accent-primary" :class="inert" @click.stop />
      <span class="text-sm text-gray-600">{{ field.placeholder || field.label }}</span>
    </div>
    <input v-else-if="field.field_type === 'date'" type="date" :value="get()" @input="set(($event.target as any).value)"
      class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none transition-colors" :class="inert" @click.stop />
    <div v-else-if="field.field_type === 'color'" class="flex items-center gap-2.5" :class="inert">
      <span class="h-9 w-12 rounded-lg border border-gray-200 shadow-inner" style="background:var(--brand-primary)" />
      <span class="text-sm text-gray-400 font-mono">#1E2157</span>
    </div>
    <div v-else-if="field.field_type === 'file'" class="flex items-center gap-2 px-3 h-9 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400" :class="inert">
      <i class="pi pi-upload text-xs" />{{ field.placeholder || 'Choose a file…' }}
    </div>
    <!-- Account: "Would you like X to login?" -->
    <div v-else-if="field.field_type === 'account'" class="space-y-1.5" @click.stop>
      <label class="flex items-center justify-between gap-3 min-h-[2.25rem] cursor-pointer">
        <span class="text-sm text-gray-700">Create a login for <span class="font-semibold">{{ ctx.instanceFirstName(subjectKey, inst) || ctx.subjectLabel(subjectKey) }}</span>?</span>
        <ToggleSwitch :modelValue="ctx.accountLogin(field, inst)" @update:modelValue="ctx.toggleAccountLogin(field, inst)" />
      </label>
      <p class="text-[11px] text-gray-400 flex items-center gap-1.5"><i class="pi pi-info-circle text-[10px]" />If yes, they get <span class="font-medium text-gray-500">{{ ctx.permissionGroupName(field) }}</span> access.</p>
    </div>
    <!-- Communication preferences -->
    <div v-else-if="field.field_type === 'comms'" @click.stop class="flex items-center gap-2">
      <MultiSelect :modelValue="ctx.commsPeople()" @update:modelValue="ctx.setCommsPeople($event)" :options="ctx.commsOptions()"
        optionLabel="label" optionValue="id" display="chip" :showToggleAll="false"
        placeholder="Select who receives communications" class="flex-1 min-w-0" />
      <button type="button" class="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white hover:border-primary text-gray-600 transition-colors" @click.stop="ctx.openCommsDialog()">
        <i class="pi pi-sliders-h text-xs" />Customise
      </button>
    </div>
    <!-- Text / Email / Tel / Number -->
    <input v-else :type="field.field_type" :value="get()" @input="set(($event.target as any).value)" :placeholder="field.placeholder || ''"
      class="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none transition-colors" :class="inert" @click.stop />
  </div>
</template>
