<template>
  <!-- Mobile-first: label stacks above the field; label-left row from md up -->
  <div class="flex flex-col sm:flex-row sm:items-start px-5 py-3.5 gap-1.5 sm:gap-4" :class="{ 'sm:items-center': !tall }">
    <div class="w-full sm:w-28 sm:shrink-0" :class="{ 'sm:pt-0.5': tall }">
      <p class="text-sm font-medium text-gray-700">
        <slot name="label">{{ label }}</slot>
      </p>
      <p v-if="description || $slots.description" class="text-xs text-gray-400 mt-0.5">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div class="flex items-center gap-2 flex-1 flex-wrap w-full sm:w-auto">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label?: string
  description?: string
  tall?: boolean   // set true when content is multi-line (aligns label to top)
}>()
</script>
