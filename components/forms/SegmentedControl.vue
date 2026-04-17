<template>
  <div class="flex p-1 bg-gray-100 rounded-xl gap-1">
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors"
      :class="modelValue === opt.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'"
      @click="$emit('update:modelValue', opt.value)">
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  options: Array<{ label: string; value: string }>
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
