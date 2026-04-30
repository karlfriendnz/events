<template>
  <div v-if="design.description === 'event'" class="px-6 py-5">
    <p class="text-sm text-gray-600 leading-relaxed">{{ event?.description || 'Event description will appear here once added in event details.' }}</p>
  </div>
  <div v-else-if="design.description === 'custom'" class="px-6 py-5">
    <RichTextEditor v-model="design.customDescription"
      placeholder="Enter a custom description for this registration form..." />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  design: { description?: 'event' | 'custom'; customDescription?: string }
  event: { description?: string | null } | null
}>()
</script>
