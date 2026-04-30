<template>
  <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div v-if="title || $slots.title || $slots['header-action']"
      class="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-gray-800">
          <slot name="title">{{ title }}</slot>
        </p>
        <p v-if="description || $slots.description" class="text-xs text-gray-400 mt-0.5">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
      <div v-if="$slots['header-action']" class="shrink-0">
        <slot name="header-action" />
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>
