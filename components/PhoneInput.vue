<template>
  <InputText :model-value="display" inputmode="tel" @update:model-value="onInput" />
</template>

<script setup lang="ts">
// Platform-wide phone field — formats NZ numbers as you type (021 555 0101).
// Stores the formatted string; lenient enough for mobile + landline.
const props = defineProps<{ modelValue?: string | null }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

function formatNZ(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)]
  if (d.length > 10) parts.push(d.slice(10))
  return parts.filter(Boolean).join(' ')
}

const display = computed(() => formatNZ(props.modelValue))
function onInput(v: string) { emit('update:modelValue', formatNZ(v)) }
</script>
