<script setup lang="ts">
/**
 * WHO IS ALLOWED TO REGISTER — the one editor for an event's restrictions.
 *
 * Today that's two rules: an age range (`events.age_min`/`age_max`) and a gender
 * (`events.gender_restriction`). It lives in ONE component because it is edited in
 * three places (the basic wizard's "Who it's for" step, the programme wizard's
 * Event details, and the event editor's Overview row) and was previously duplicated
 * into one of them and deleted from the other two — which is how an event ended up
 * with a restriction nobody could see or change after creation.
 *
 * THIS IS WHERE THE RULE ENGINE GROWS. The intended next step is an arbitrary
 * rule list — "field X = Y", "holds this person type", "has this record" — so a
 * registrant who wasn't invited is still blocked unless they qualify. The vocabulary
 * for that already exists in `useDisciplineRequirements()` (operators, field_key over
 * core + custom fields, applies_to person types, and the pure `testRequirement` /
 * `unmetFor` evaluator). When we build it, reuse that engine rather than inventing a
 * second one, and add the rule list to THIS component — every host picks it up free.
 */
import { GENDER_RESTRICTION_OPTIONS } from '~/composables/useEventRestrictions'

const props = withDefaults(defineProps<{
  ageMin: number | null
  ageMax: number | null
  genderRestriction: string | null
  /** Row padding — hosts that supply their own card gutters pass their own. */
  rowPadding?: string
  /** Hairlines between the rows (off when the host's card already divides them). */
  divided?: boolean
}>(), { rowPadding: 'px-5 py-4', divided: true })

const emit = defineEmits<{
  (e: 'update:ageMin', v: number | null): void
  (e: 'update:ageMax', v: number | null): void
  (e: 'update:genderRestriction', v: string | null): void
}>()

const rowClass = computed(() =>
  `${props.rowPadding} flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6`)

// Max can never sit below Min: the floor follows whatever Min is, so an impossible
// range can't be typed. Raising Min past Max pushes Max UP with it rather than
// blocking the edit — being trapped in a range you're trying to change is worse than
// the invalid state itself.
function setAgeMin(v: number | null) {
  emit('update:ageMin', v ?? null)
  if (v != null && props.ageMax != null && props.ageMax < v) emit('update:ageMax', v)
}
</script>

<template>
  <div :class="divided ? 'divide-y divide-gray-100' : ''">

    <!-- Age -->
    <div :class="rowClass">
      <div class="flex-1 min-w-0">
        <p class="field-label">Age limit</p>
        <p class="field-help mt-0.5">Leave blank for no limit. Checked against the registrant's date of birth.</p>
      </div>
      <div class="flex items-center gap-2 shrink-0 flex-wrap">
        <InputNumber :model-value="ageMin" :min="0" :max="120" :use-grouping="false"
          placeholder="Min" class="w-20" :input-class="'w-20 text-center'"
          @update:model-value="setAgeMin" />
        <span class="field-help">to</span>
        <InputNumber :model-value="ageMax" :min="ageMin ?? 0" :max="120" :use-grouping="false"
          placeholder="Max" class="w-20" :input-class="'w-20 text-center'"
          @update:model-value="v => emit('update:ageMax', v ?? null)" />
        <span class="field-help">years</span>
      </div>
    </div>

    <!-- Gender -->
    <div :class="rowClass">
      <div class="flex-1 min-w-0">
        <p class="field-label">Gender</p>
        <p class="field-help mt-0.5">Only people of this gender can register.</p>
      </div>
      <Select :model-value="genderRestriction" :options="GENDER_RESTRICTION_OPTIONS"
        option-label="label" option-value="value" class="w-44 shrink-0"
        @update:model-value="v => emit('update:genderRestriction', v ?? null)" />
    </div>

  </div>
</template>
