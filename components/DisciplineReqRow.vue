<!--
  One requirement row inside <DisciplineWizard>.

  ONE LINE: field · phrasing · value · ✕. It carries no "who is this for" picker and
  no lead-in words — the row lives under a cast heading ("Every Coach") and the
  SECTION says both who it's for and that they must have it. Saying it again on the
  row gave "Every Coach / Must have / NZ FB ID / must be recorded": three sayings of
  one thing, which is the exact fault this editor keeps getting punished for (a flat
  drawer, then two rule steps, then scope-chips-plus-sections).

  The club message is the rare case, so it hides behind a link rather than putting an
  empty text box on every row.
-->
<script setup lang="ts">
import type { PersonFieldDef } from '~/composables/usePersonFields'
import type { ReqEntry } from '~/composables/useDisciplineRequirements'

const props = defineProps<{
  row: any
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
// Open when there's already a message, so an existing one is never hidden.
const noteOpen = ref(!!props.row.message)
const SEL = 'text-sm border border-gray-300 rounded px-2 py-1.5 bg-white'
</script>

<template>
  <div class="group/req">
    <div class="flex items-center gap-2">
      <select :value="row.field_key" :class="SEL" class="flex-1 min-w-0"
        style="-webkit-appearance:auto;appearance:auto;"
        @change="onPick($event.target as HTMLSelectElement, row)">
        <option value="">Choose a field…</option>
        <optgroup label="Their details">
          <option v-for="f in coreFields" :key="f.key" :value="f.key">{{ f.label }}</option>
        </optgroup>
        <optgroup v-if="customFields.length" :label="orgName + ' fields'">
          <option v-for="f in customFields" :key="f.key" :value="f.key">{{ f.label }}</option>
        </optgroup>
        <!-- Don't send someone to Settings and back just to invent "School".
             NB a real label: a blank one renders as an unreadable gap in the list. -->
        <optgroup label="Not there?">
          <option :value="NEW">+ Create a new field…</option>
        </optgroup>
      </select>

      <select :value="operatorLabel" :class="SEL" class="shrink-0"
        style="-webkit-appearance:auto;appearance:auto;"
        @change="emit('operator', ($event.target as HTMLSelectElement).value)">
        <option v-for="o in options" :key="o.label" :value="o.label">{{ o.label }}</option>
      </select>

      <!-- Is Between takes a pair. -->
      <div v-if="showsRange" class="flex items-center gap-1 shrink-0">
        <input type="number" :value="Array.isArray(row.value) ? row.value[0] : null" placeholder="from"
          :class="SEL" class="w-20"
          @input="emit('range', { i: 0, v: ($event.target as HTMLInputElement).value })" />
        <span class="text-xs text-gray-400">–</span>
        <input type="number" :value="Array.isArray(row.value) ? row.value[1] : null" placeholder="to"
          :class="SEL" class="w-20"
          @input="emit('range', { i: 1, v: ($event.target as HTMLInputElement).value })" />
      </div>

      <template v-else-if="showsValue">
        <select v-if="valueOptions" v-model="row.value" :class="SEL" class="shrink-0 w-36"
          style="-webkit-appearance:auto;appearance:auto;">
          <option v-for="v in valueOptions" :key="v" :value="v">{{ v }}</option>
        </select>
        <input v-else-if="numeric" v-model="row.value" type="number" placeholder="Value" :class="SEL" class="w-24 shrink-0" />
        <input v-else v-model="row.value" placeholder="Value" :class="SEL" class="w-36 shrink-0" />
      </template>

      <button class="text-gray-300 hover:text-red-500 shrink-0 px-1" v-tooltip.top="'Remove'" @click="emit('remove')">
        <i class="pi pi-times text-xs" />
      </button>
    </div>

    <!-- The note + the shadow warning are both exceptions — off the main line. -->
    <div v-if="noteOpen" class="mt-1.5 pl-0.5">
      <InputText v-model="row.message" placeholder="What the club sees if it's not met" class="w-full" size="small" />
    </div>
    <button v-else
      class="mt-1 text-xs text-gray-400 hover:text-primary opacity-0 group-hover/req:opacity-100 focus:opacity-100 transition-opacity"
      @click="noteOpen = true">+ add a note for clubs</button>

    <!-- Closest-wins deletes an ancestor's rule silently. Say so, in place. -->
    <div v-if="shadowed" class="mt-1.5 text-xs text-gray-400 flex items-start justify-between gap-2">
      <span class="min-w-0">
        replaces
        <span class="line-through">{{ fieldLabel(shadowed.field_key) }} {{ shadowed.rows.map(describeRequirement).join(' · ') }}</span>
        from {{ shadowed.source.disciplineName }}
      </span>
      <button class="text-primary hover:underline shrink-0" @click="emit('revert')">Revert</button>
    </div>
  </div>
</template>
