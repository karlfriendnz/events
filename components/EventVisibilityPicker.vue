<script setup lang="ts">
/*
  Event visibility — WHO CAN SEE an event (migration 287).

  One component, every creation surface. It started life inline in the Quick event
  dialog; basic/advanced needed the same control, and three copies of a four-option
  model (plus three copies of the option loaders) is three chances for them to drift.

  Custom = any combination of people TYPES, GROUPS or specific PEOPLE — the
  system-wide "a permission target is a person OR a people type" rule. Its options
  are LAZY: they're three org-wide queries, and most events never pick Custom.
*/
const props = withDefaults(defineProps<{
  modelValue: string
  typeKeys?: string[]
  groupIds?: string[]
  personIds?: string[]
  /** Rendered as a labelled row (label left) unless the host wants bare controls. */
  label?: string
  labelWidth?: string
  /** Hide the Custom option (its combination-picker isn't enforced yet). Opt-in per
   *  surface so re-enabling is a one-line flip. */
  hideCustom?: boolean
}>(), {
  typeKeys: () => [],
  groupIds: () => [],
  personIds: () => [],
  label: 'Visibility',
  labelWidth: 'sm:w-20',
  hideCustom: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'update:typeKeys', v: string[]): void
  (e: 'update:groupIds', v: string[]): void
  (e: 'update:personIds', v: string[]): void
}>()

const { orgId } = useOrg()

const VISIBILITY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Invitees only', value: 'internal' },
  { label: 'All members', value: 'all_members' },
  { label: 'Custom', value: 'custom' },
]
const options = computed(() => props.hideCustom ? VISIBILITY_OPTIONS.filter(o => o.value !== 'custom') : VISIBILITY_OPTIONS)

const typeOptions = ref<{ value: string; label: string }[]>([])
const groupOptions = ref<{ value: string; label: string; color?: string }[]>([])
const peopleOptions = ref<{ value: string; label: string }[]>([])
let loaded = false

async function loadOptions() {
  if (loaded || !orgId.value) return
  loaded = true
  const [types, groups, people] = await Promise.all([
    useOrgFieldPolicy().loadOrgTypes(orgId.value).catch(() => [] as any[]),
    useGroupsApi().list(orgId.value).catch(() => [] as any[]),
    usePeopleApi().list(orgId.value).catch(() => [] as any[]),
  ])
  typeOptions.value = (types as any[])
    .filter(t => (t.kind ?? 'person') === 'person')
    .map(t => ({ value: t.key, label: t.label }))
  groupOptions.value = (groups as any[]).map(g => ({ value: g.id, label: g.name, color: g.color }))
  peopleOptions.value = (people as any[]).map(p => ({
    value: p.id,
    label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.email || 'Unnamed',
  }))
}

// Load when Custom is chosen — and on mount if the event is ALREADY custom, or an
// edited event would show its saved picks as bare ids with no labels to match them.
watch(() => props.modelValue, v => { if (v === 'custom') loadOptions() })
onMounted(() => { if (props.modelValue === 'custom') loadOptions() })
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4">
    <span v-if="label" class="field-label shrink-0 sm:pt-1.5" :class="labelWidth">{{ label }}</span>
    <div class="flex-1 min-w-0 space-y-2">
      <SelectButton :model-value="modelValue" :options="options"
        option-label="label" option-value="value" :allow-empty="false" size="small"
        @update:model-value="emit('update:modelValue', $event)" />
      <div v-if="modelValue === 'custom'" class="space-y-2 rounded-lg border border-gray-200 p-3 bg-gray-50/60">
        <p class="field-help">Pick who can see it — any combination of types, groups or people.</p>
        <ChipMultiSelect :model-value="typeKeys" :options="typeOptions" option-label="label" option-value="value"
          placeholder="People types"   class="w-full" :show-toggle-all="false"
          @update:model-value="emit('update:typeKeys', $event)" />
        <ChipMultiSelect :model-value="groupIds" :options="groupOptions" option-label="label" option-value="value"
          placeholder="Groups"   class="w-full" :show-toggle-all="false"
          @update:model-value="emit('update:groupIds', $event)">
          <template #option="{ option }">
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#94a3b8' }" />{{ option.label }}
            </span>
          </template>
        </ChipMultiSelect>
        <ChipMultiSelect :model-value="personIds" :options="peopleOptions" option-label="label" option-value="value"
          placeholder="Specific people"   class="w-full" :show-toggle-all="false"
          @update:model-value="emit('update:personIds', $event)" />
      </div>
    </div>
  </div>
</template>
