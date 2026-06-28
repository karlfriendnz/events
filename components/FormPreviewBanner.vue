<template>
  <div class="relative overflow-hidden" style="height:220px">
    <template v-if="design.header === 'custom'">
      <div v-if="!design.headerImage" class="absolute inset-0 bg-gray-200 flex flex-col items-center justify-center gap-2">
        <i class="pi pi-image text-gray-400 text-sm" />
        <span class="text-sm text-gray-400">Custom header image</span>
      </div>
      <img v-else :src="design.headerImage" class="absolute inset-0 w-full h-full object-cover" />
    </template>
    <template v-else>
      <div class="absolute inset-0 bg-gradient-to-br from-primary to-[#2e38a8]" />
      <img v-if="event?.banner_url" :src="event.banner_url" class="absolute inset-0 w-full h-full object-cover" />
    </template>
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    <div class="absolute bottom-5 left-4 right-4 sm:left-6 sm:right-6">
      <p class="text-white text-sm font-bold drop-shadow">{{ event?.title || 'Event Title' }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  design: { header?: 'event' | 'custom'; headerImage?: string | null }
  event: { title?: string | null; banner_url?: string | null } | null
}>()
</script>
