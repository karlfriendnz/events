<template>
  <!-- NO IMAGE, NO BANNER. Without one this was still a 400px block — a grey
       "Custom header image" placeholder in custom mode, or a brand gradient in event
       mode — pushing the actual form down the page for decoration nobody chose. The
       banner only exists once there's an image to show. -->
  <div v-if="imageUrl" class="relative overflow-hidden" style="height:400px">
    <div class="absolute inset-0 bg-gradient-to-br from-primary to-[#2e38a8]" />
    <img :src="imageUrl" class="absolute inset-0 w-full h-full object-cover" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    <div class="absolute bottom-5 left-4 right-4 sm:left-6 sm:right-6">
      <p class="text-white text-sm font-bold drop-shadow">{{ event?.title || 'Event Title' }}</p>
    </div>
  </div>
  <!-- No image: the form still needs to say what it's FOR, so the title becomes a
       plain row instead of riding on a picture. -->
  <div v-else-if="event?.title" class="px-4 sm:px-6 py-3.5 border-b border-gray-100">
    <p class="text-base font-semibold text-gray-900">{{ event.title }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  design: { header?: 'event' | 'custom'; headerImage?: string | null }
  event: { title?: string | null; banner_url?: string | null } | null
}>()

// Which image the design asks for: a custom header uses its own upload, otherwise the
// event's banner. Either way, no URL = nothing to show.
const imageUrl = computed(() => (props.design?.header === 'custom'
  ? props.design?.headerImage
  : props.event?.banner_url) || null)
</script>
