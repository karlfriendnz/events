<template>
  <Select
    :model-value="displayValue"
    :options="options"
    option-label="label"
    option-value="value"
    class="flex-1"
    @update:model-value="onChange"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { buildRepeatOptions, rruleToSummary } from '~/composables/useRepeatOptions'

const props = defineProps<{
  modelValue: string
  date?: Date | null
  showCustom?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'customRepeat'): void
}>()

// Map '' to 'NONE' for display (PrimeVue treats '' as no selection)
const displayValue = computed(() => props.modelValue === '' ? 'NONE' : props.modelValue)

const options = computed(() => {
  let opts = buildRepeatOptions(props.date ?? null)
  if (!props.showCustom) opts = opts.filter(o => o.value !== 'CUSTOM')
  const v = props.modelValue
  if (v && v !== 'NONE' && v !== '' && v !== 'CUSTOM' && !opts.find(o => o.value === v)) {
    const customIdx = opts.findIndex(o => o.value === 'CUSTOM')
    const insertAt = customIdx >= 0 ? customIdx : opts.length
    const copy = [...opts]
    copy.splice(insertAt, 0, { label: rruleToSummary(v), value: v })
    return copy
  }
  return opts
})

function onChange(v: string) {
  if (v === 'CUSTOM') emit('customRepeat')
  else emit('update:modelValue', v === 'NONE' ? '' : v)
}
</script>
