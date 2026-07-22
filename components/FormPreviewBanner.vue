<template>
  <!-- WITH an image: the banner is the picture + the title over it. In the builder
       (editable) the title is click-to-edit and a "Change image" control appears on
       hover. -->
  <div v-if="imageUrl" class="relative overflow-hidden group" style="height:400px">
    <div class="absolute inset-0 bg-gradient-to-br from-primary to-[#2e38a8]" />
    <img :src="imageUrl" class="absolute inset-0 w-full h-full object-cover" />
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    <div class="absolute bottom-5 left-4 right-4 sm:left-6 sm:right-6">
      <input v-if="editable" :value="event?.title || ''" @input="emitTitle" @keydown.enter.prevent="($event.target as any).blur()"
        placeholder="Event name"
        class="w-full bg-transparent text-white text-2xl font-bold drop-shadow outline-none border-b border-transparent hover:border-white/40 focus:border-white/70 transition-colors placeholder-white/60" />
      <p v-else class="text-white text-2xl font-bold drop-shadow">{{ event?.title || 'Event Title' }}</p>
    </div>
    <button v-if="editable" type="button" @click="pick"
      class="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/45 hover:bg-black/60 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
      <i class="pi pi-image text-[10px]" />Change image
    </button>
  </div>
  <!-- NO image: the form still needs to say what it's FOR, so the title becomes a plain
       row. In the builder it's editable and offers an upload-banner action. -->
  <div v-else class="px-4 sm:px-6 py-3.5 border-b border-gray-100 group">
    <div v-if="editable" class="flex items-center gap-2">
      <input :value="event?.title || ''" @input="emitTitle" @keydown.enter.prevent="($event.target as any).blur()"
        placeholder="Event name"
        class="flex-1 min-w-0 text-base font-semibold text-gray-900 bg-transparent outline-none border-b border-transparent hover:border-gray-200 focus:border-primary transition-colors placeholder-gray-400" />
      <button type="button" @click="pick"
        class="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-primary hover:text-primary text-[11px] font-semibold transition-colors">
        <i class="pi pi-image text-[10px]" />Add banner image
      </button>
    </div>
    <p v-else-if="event?.title" class="text-base font-semibold text-gray-900">{{ event.title }}</p>
  </div>

  <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
</template>

<script setup lang="ts">
const props = defineProps<{
  design: { header?: 'event' | 'custom' | 'none'; headerImage?: string | null }
  event: { title?: string | null; banner_url?: string | null } | null
  /** Builder mode: title is editable + a banner-upload control shows. */
  editable?: boolean
}>()
const emit = defineEmits<{ (e: 'update:title', v: string): void; (e: 'upload', file: File): void }>()

// Which image the design asks for: a custom header uses its own upload, otherwise the
// event's banner. Either way, no URL = nothing to show.
const imageUrl = computed(() => {
  if (props.design?.header === 'none') return null         // explicitly no banner image
  return (props.design?.header === 'custom' ? props.design?.headerImage : props.event?.banner_url) || null
})

const fileInput = ref<HTMLInputElement | null>(null)
function pick() { fileInput.value?.click() }
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) emit('upload', f)
  ;(e.target as HTMLInputElement).value = ''
}
function emitTitle(e: Event) { emit('update:title', (e.target as HTMLInputElement).value) }
</script>
