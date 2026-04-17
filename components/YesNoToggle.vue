<template>
  <div class="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium shrink-0">
    <button type="button"
      class="px-4 py-1.5 transition-colors"
      :class="!value ? 'bg-[#1E2157] text-white' : 'text-gray-500 bg-white hover:bg-gray-50'"
      @click="emit('update', false)">No</button>
    <button type="button"
      class="px-4 py-1.5 transition-colors border-l border-gray-200"
      :class="value ? 'bg-[#1E2157] text-white' : 'text-gray-500 bg-white hover:bg-gray-50'"
      @click="emit('update', true)">Yes</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: boolean }>()
const emit = defineEmits<{ update: [boolean] }>()
</script>
