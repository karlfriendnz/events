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
  /** Hide the Custom option (its combination-picker isn't enforced yet). Hidden by
   *  DEFAULT on every surface — pass `:hide-custom="false"` to bring it back, so
   *  re-enabling it (here or per surface) stays a one-line flip. */
  hideCustom?: boolean
  /**
   * Ask it as a SWITCH instead of four options: "Display for others" off (only the
   * people you invite see it) → on, and only then "the whole club" or "certain
   * people". Four flat options made you weigh four audiences before deciding the
   * real question, which is whether anyone beyond the invitees sees it at all.
   * Public isn't offered here — the surfaces using this ask about public sign-ups
   * as their own question.
   */
  asSwitch?: boolean
}>(), {
  typeKeys: () => [],
  groupIds: () => [],
  personIds: () => [],
  // Names what it actually controls: where the event SHOWS UP (the club calendar
  // and the public site), not who is invited to it — that's the invitee list next to
  // it, and "Who can see it" beside "Choose invitees" read as the same question twice.
  label: 'Calendar visibility',
  labelWidth: 'sm:w-20',
  hideCustom: true,
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
// An event ALREADY saved as custom keeps the option on show — dropping it would
// leave the SelectButton with nothing selected and silently re-answer the question.
const options = computed(() =>
  props.hideCustom && props.modelValue !== 'custom'
    ? VISIBILITY_OPTIONS.filter(o => o.value !== 'custom')
    : VISIBILITY_OPTIONS)

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

// ── Switch form ───────────────────────────────────────────────────────────
// "Shown to others" is everything except invitees-only. `public` counts as shown
// (an event on the public site is certainly displayed) so an already-public event
// doesn't render with the switch off.
const shownToOthers = computed(() => props.modelValue !== 'internal')
const AUDIENCE_OPTIONS = [
  { label: 'The whole club', value: 'all_members' },
  { label: 'Certain people', value: 'custom' },
]
function setShown(on: boolean) {
  // Off returns to invitees-only. On lands on the whole club — the common answer,
  // and one more click gets you to a narrower list.
  emit('update:modelValue', on ? 'all_members' : 'internal')
}
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-start gap-1.5 sm:gap-4">
    <span v-if="label" class="field-label shrink-0 sm:pt-1.5" :class="labelWidth">{{ label }}</span>
    <div class="flex-1 min-w-0 space-y-2">
      <template v-if="asSwitch">
        <div class="flex items-center gap-3">
          <ToggleSwitch :model-value="shownToOthers" @update:model-value="setShown" />
          <span class="text-sm text-gray-700">Display for others</span>
        </div>
        <p v-if="!shownToOthers" class="field-help">Only the people you invite below will see it.</p>
        <SelectButton v-else :model-value="modelValue === 'custom' ? 'custom' : 'all_members'"
          :options="AUDIENCE_OPTIONS" option-label="label" option-value="value"
          :allow-empty="false" size="small"
          @update:model-value="emit('update:modelValue', $event)" />
      </template>
      <SelectButton v-else :model-value="modelValue" :options="options"
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
