<template>
  <div v-if="design.description === 'event'" class="px-4 sm:px-6 py-5">
    <p class="text-sm text-gray-600 leading-relaxed">{{ event?.description || 'Event description will appear here once added in event details.' }}</p>
  </div>
  <div v-else-if="design.description === 'custom'" class="px-4 sm:px-6 py-5">
    <!-- Public/registrant view: static rendered text. Builder: bubble editor (select to format). -->
    <div v-if="readonly" class="prose prose-sm max-w-none text-gray-600 leading-relaxed" v-html="design.customDescription || ''" />
    <RichTextEditor v-else v-model="design.customDescription" bubble
      placeholder="Enter a custom description for this registration form..." />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  design: { description?: 'event' | 'custom'; customDescription?: string }
  event: { description?: string | null } | null
  /** Public preview — show the description as static text (no editor). */
  readonly?: boolean
}>()
</script>
