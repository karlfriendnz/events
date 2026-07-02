<!--
  CodeTabsSelect — the "Tabs (codes)" picker for a Classes view. Lists every code
  indented by hierarchy. Selecting a PARENT cascades its whole subtree into the
  selection AND locks (disables) those descendants so they can't be individually
  unchecked while the parent is chosen — deselecting the parent releases them.
  The chips show only the "root" selections (a code whose ancestor is also
  selected is implied), so choosing Davenport reads as one "Davenport" chip even
  though its children are checked underneath. Used by /groups/views + /groups/view/:id.
-->
<script setup lang="ts">
import type { GroupCode } from '~/composables/useGroupCodes'

const props = defineProps<{ modelValue: string[]; codes: GroupCode[] }>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const gc = useGroupCodes()

const codeById = computed(() => Object.fromEntries(props.codes.map(c => [c.id, c])) as Record<string, GroupCode>)
const childrenOf = computed(() => {
  const m: Record<string, string[]> = {}
  for (const c of props.codes) {
    const p = c.parent_id && props.codes.some(x => x.id === c.parent_id) ? c.parent_id : null
    if (p) (m[p] ??= []).push(c.id)
  }
  return m
})
function descendantsOf(id: string): string[] {
  const out: string[] = []
  const stack = [...(childrenOf.value[id] ?? [])]
  let guard = 0
  while (stack.length && guard++ < 1000) {
    const cur = stack.pop()!
    out.push(cur)
    stack.push(...(childrenOf.value[cur] ?? []))
  }
  return out
}
function hasSelectedAncestor(id: string, sel: Set<string>): boolean {
  let cur = codeById.value[id]?.parent_id ?? null, guard = 0
  while (cur && guard++ < 50) {
    if (sel.has(cur)) return true
    cur = codeById.value[cur]?.parent_id ?? null
  }
  return false
}

// Indented options, each flagged disabled when a selected ancestor implies it.
const options = computed(() => {
  const sel = new Set(props.modelValue)
  return gc.treeOptions(props.codes).map(o => ({ ...o, disabled: hasSelectedAncestor(o.value, sel) }))
})

// Chips = only the "root" selections (no selected ancestor).
const rootChips = computed(() => {
  const sel = new Set(props.modelValue)
  return props.modelValue
    .filter(id => codeById.value[id] && !hasSelectedAncestor(id, sel))
    .map(id => ({ id, name: codeById.value[id]?.name ?? id }))
})

function onChange(raw: string[]) {
  const prev = new Set(props.modelValue)
  const next = new Set(raw)
  for (const id of raw) if (!prev.has(id)) for (const d of descendantsOf(id)) next.add(d)     // parent added → pull children
  for (const id of props.modelValue) if (!next.has(id)) for (const d of descendantsOf(id)) next.delete(d) // parent removed → release
  emit('update:modelValue', [...next])
}
function removeCode(id: string) {
  const next = new Set(props.modelValue)
  next.delete(id)
  for (const d of descendantsOf(id)) next.delete(d)
  emit('update:modelValue', [...next])
}
</script>

<template>
  <MultiSelect :modelValue="modelValue" @update:modelValue="onChange"
    :options="options" option-label="label" option-value="value" option-disabled="disabled"
    filter placeholder="All codes" class="w-full">
    <template #value="{ value }">
      <template v-if="!value || !value.length"><span class="text-gray-400">All codes</span></template>
      <span v-for="chip in rootChips" :key="chip.id"
        class="inline-flex items-center gap-1 mr-1 mb-0.5 px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
        {{ chip.name }}
        <i class="pi pi-times-circle cursor-pointer text-[11px] hover:text-slate-900" @click.stop="removeCode(chip.id)" />
      </span>
    </template>
  </MultiSelect>
</template>
