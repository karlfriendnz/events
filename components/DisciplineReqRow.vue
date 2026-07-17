<!--
  One requirement row inside <DisciplineWizard>. Shared by the "Who it's for" and
  "What to record" steps — the two differ only in their lead-in words ("Is …" vs
  "Must have …"), because the rows themselves are the same shape and write the same
  table; `purpose` is what separates them.

  Structure mirrors the condition-row block in <FormFieldAdvancedEditor> so the two
  editors read alike. NB mirror its STRUCTURE, not its type scale — that file
  predates the type-scale rule and is full of arbitrary sizes.
-->
<script setup lang="ts">
import type { PersonFieldDef } from '~/composables/usePersonFields'
import type { ReqEntry } from '~/composables/useDisciplineRequirements'

defineProps<{
  row: any
  index: number
  coreFields: PersonFieldDef[]
  customFields: PersonFieldDef[]
  orgName: string
  options: { label: string; exempt: boolean; operator: string | null }[]
  operatorLabel: string
  showsValue: boolean
  showsRange: boolean
  valueOptions: string[] | null
  numeric: boolean
  /** The ancestor rule this row replaces, if any — closest-wins hides it otherwise. */
  shadowed: ReqEntry | null
  fieldLabel: (key: string) => string
  lead: string
  leadMore: string
}>()
const emit = defineEmits<{
  (e: 'field-change'): void
  (e: 'operator', label: string): void
  (e: 'range', v: { i: 0 | 1; v: any }): void
  (e: 'remove'): void
  (e: 'revert'): void
  (e: 'create-field'): void
}>()

// Picking "+ Create a new field…" must not stick as the row's value — hand it to
// the host and leave the select where it was.
const NEW = '__new__'
function onPick(el: HTMLSelectElement, row: any) {
  if (el.value === NEW) { el.value = row.field_key || ''; emit('create-field'); return }
  row.field_key = el.value
  emit('field-change')
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 p-3 space-y-2">
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs font-medium text-gray-500">{{ index === 0 ? lead : leadMore }}</span>
      <button class="text-gray-300 hover:text-red-500" v-tooltip.top="'Remove'" @click="emit('remove')">
        <i class="pi pi-times text-xs" />
      </button>
    </div>

    <select :value="row.field_key" class="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
      style="-webkit-appearance:auto;appearance:auto;background:white;"
      @change="onPick($event.target as HTMLSelectElement, row)">
      <option value="">Choose…</option>
      <optgroup label="Their details">
        <option v-for="f in coreFields" :key="f.key" :value="f.key">{{ f.label }}</option>
      </optgroup>
      <optgroup v-if="customFields.length" :label="orgName + ' fields'">
        <option v-for="f in customFields" :key="f.key" :value="f.key">{{ f.label }}</option>
      </optgroup>
      <!-- Don't send someone to Settings and back mid-wizard just to invent "School". -->
      <optgroup label=" ">
        <option :value="NEW">+ Create a new field…</option>
      </optgroup>
    </select>

    <div class="flex gap-2">
      <select :value="operatorLabel" class="text-sm border border-gray-300 rounded px-2 py-1.5"
        :class="showsValue ? 'w-1/2' : 'w-full'"
        style="-webkit-appearance:auto;appearance:auto;background:white;"
        @change="emit('operator', ($event.target as HTMLSelectElement).value)">
        <option v-for="o in options" :key="o.label" :value="o.label">{{ o.label }}</option>
      </select>

      <!-- Is Between takes a pair. -->
      <div v-if="showsRange" class="w-1/2 flex items-center gap-1">
        <input type="number" :value="Array.isArray(row.value) ? row.value[0] : null" placeholder="from"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
          @input="emit('range', { i: 0, v: ($event.target as HTMLInputElement).value })" />
        <span class="text-xs text-gray-400">–</span>
        <input type="number" :value="Array.isArray(row.value) ? row.value[1] : null" placeholder="to"
          class="w-full text-sm border border-gray-300 rounded px-2 py-1.5"
          @input="emit('range', { i: 1, v: ($event.target as HTMLInputElement).value })" />
      </div>

      <template v-else-if="showsValue">
        <select v-if="valueOptions" v-model="row.value" class="w-1/2 text-sm border border-gray-300 rounded px-2 py-1.5"
          style="-webkit-appearance:auto;appearance:auto;background:white;">
          <option v-for="v in valueOptions" :key="v" :value="v">{{ v }}</option>
        </select>
        <input v-else-if="numeric" v-model="row.value" type="number" placeholder="Value"
          class="w-1/2 text-sm border border-gray-300 rounded px-2 py-1.5" />
        <InputText v-else v-model="row.value" placeholder="Value" class="w-1/2" />
      </template>
    </div>

    <InputText v-model="row.message" placeholder="What the club sees if it's not met (optional)" class="w-full" />

    <!-- Closest-wins deletes an ancestor's rule silently. Say so, in place. -->
    <div v-if="shadowed" class="text-xs text-gray-400 border-t border-gray-100 pt-2 flex items-start justify-between gap-2">
      <span class="min-w-0">
        replaces
        <span class="line-through">{{ fieldLabel(shadowed.field_key) }} {{ shadowed.rows.map(describeRequirement).join(' · ') }}</span>
        from {{ shadowed.source.disciplineName }}
      </span>
      <button class="text-primary hover:underline shrink-0" @click="emit('revert')">Revert</button>
    </div>
  </div>
</template>
