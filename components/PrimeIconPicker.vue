<!--
  PrimeIconPicker — searchable PrimeIcons picker for nav/menu icons. v-model is the
  full class name, e.g. "pi-calendar" (rendered as `<i class="pi pi-calendar">`).
  Search the grid, or type any PrimeIcon name and "Use …" it (the whole set is
  reachable, not just the curated grid). Mirrors <IconPicker> (which is Font Awesome).
-->
<template>
  <div class="relative">
    <button type="button"
      class="w-full h-9 px-2 inline-flex items-center justify-between gap-1 rounded-lg border border-gray-200 bg-white hover:border-gray-300"
      @click="open = !open">
      <span class="inline-flex items-center gap-2 min-w-0">
        <i v-if="modelValue" :class="`pi ${modelValue}`" :style="accent ? { color: accent } : undefined" />
        <i v-else class="pi pi-image text-gray-300" />
        <span class="text-sm text-gray-500 truncate">{{ modelValue || 'Choose an icon' }}</span>
      </span>
      <i class="pi pi-chevron-down text-[8px] text-gray-400 shrink-0" />
    </button>

    <template v-if="open">
      <div class="fixed inset-0 z-40" @click="open = false" />
      <div class="absolute left-0 z-50 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
        <input v-model="q" type="text" placeholder="Search icons…" autofocus
          class="w-full h-8 px-2 mb-2 text-sm border border-gray-200 rounded-md outline-none focus:border-primary" />
        <div class="grid grid-cols-6 gap-1 max-h-52 overflow-auto">
          <button v-for="ic in filtered" :key="ic" type="button" :title="ic"
            class="h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
            :class="modelValue === ('pi-' + ic) ? 'bg-primary/10 text-primary' : ''"
            @click="pick(ic)"><i :class="`pi pi-${ic}`" /></button>
        </div>
        <button v-if="customSlug && !ICONS.includes(customSlug)" type="button"
          class="w-full mt-2 px-2 py-1.5 text-xs text-left rounded hover:bg-gray-50 flex items-center gap-2"
          @click="pick(customSlug)">
          <i :class="`pi pi-${customSlug} text-gray-500`" />Use “{{ customSlug }}”
        </button>
        <div class="flex items-center justify-between mt-1">
          <button v-if="modelValue" type="button" class="text-xs text-gray-400 hover:text-red-500" @click="pick('')">Clear</button>
          <span class="text-[10px] text-gray-300 ml-auto">PrimeIcons</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue?: string; accent?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const open = ref(false)
const q = ref('')

// A broad set of PrimeIcons names (without the leading `pi-`). Anything not here is
// still reachable by typing its name (the "Use …" row).
const ICONS = [
  'calendar', 'calendar-plus', 'calendar-minus', 'calendar-times', 'clock', 'history', 'stopwatch', 'hourglass',
  'star', 'star-fill', 'heart', 'heart-fill', 'flag', 'flag-fill', 'bookmark', 'bookmark-fill', 'bolt', 'sparkles', 'crown', 'verified',
  'sun', 'moon', 'cloud', 'globe', 'map', 'map-marker', 'compass', 'directions',
  'users', 'user', 'user-plus', 'user-edit', 'id-card', 'graduation-cap',
  'trophy', 'ticket', 'tag', 'tags', 'gift', 'megaphone', 'bell', 'send', 'envelope', 'phone', 'comment', 'comments', 'inbox', 'share-alt',
  'camera', 'image', 'images', 'video', 'microphone', 'palette', 'book', 'briefcase', 'building', 'home',
  'shopping-cart', 'shopping-bag', 'wallet', 'dollar', 'money-bill', 'credit-card',
  'chart-bar', 'chart-line', 'chart-pie', 'table', 'list', 'th-large', 'sitemap', 'car',
  'check-circle', 'info-circle', 'question-circle', 'exclamation-circle', 'exclamation-triangle',
  'shield', 'lock', 'key', 'cog', 'wrench', 'thumbs-up', 'heart',
]

const customSlug = computed(() =>
  q.value.trim().toLowerCase().replace(/^pi[ -]+/, '').replace(/^pi-/, '').replace(/[^a-z0-9-]/g, ''))

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return ICONS
  return ICONS.filter(n => n.includes(s))
})

function pick(name: string) {
  emit('update:modelValue', name ? `pi-${name}` : '')
  open.value = false
  q.value = ''
}
</script>
