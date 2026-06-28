<!--
  IconPicker — searchable Font Awesome (Free, solid) icon picker. v-model is the full
  class string, e.g. "fa-solid fa-user". Search the grid, or type any FA name and
  "Use …" it (so the whole FA Free library is reachable, not just the curated grid).
-->
<template>
  <div class="relative">
    <button type="button"
      class="w-full h-9 px-2 inline-flex items-center justify-between gap-1 rounded-lg border border-gray-200 bg-white hover:border-gray-300"
      @click="open = !open">
      <i v-if="modelValue" :class="`${modelValue} text-gray-600`" />
      <i v-else class="fa-regular fa-image text-gray-300" />
      <i class="pi pi-chevron-down text-[8px] text-gray-400" />
    </button>

    <template v-if="open">
      <div class="fixed inset-0 z-40" @click="open = false" />
      <div class="absolute left-0 z-50 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
        <input v-model="q" type="text" placeholder="Search icons…" autofocus
          class="w-full h-8 px-2 mb-2 text-sm border border-gray-200 rounded-md outline-none focus:border-primary" />
        <div class="grid grid-cols-6 gap-1 max-h-52 overflow-auto">
          <button v-for="ic in filtered" :key="ic" type="button" :title="ic"
            class="h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
            :class="modelValue === ('fa-solid fa-' + ic) ? 'bg-primary/10 text-primary' : ''"
            @click="pick(ic)"><i :class="`fa-solid fa-${ic}`" /></button>
        </div>
        <button v-if="customSlug && !ICONS.includes(customSlug)" type="button"
          class="w-full mt-2 px-2 py-1.5 text-xs text-left rounded hover:bg-gray-50 flex items-center gap-2"
          @click="pick(customSlug)">
          <i :class="`fa-solid fa-${customSlug} text-gray-500`" />Use “{{ customSlug }}”
        </button>
        <div class="flex items-center justify-between mt-1">
          <button v-if="modelValue" type="button" class="text-xs text-gray-400 hover:text-red-500" @click="pick('')">Clear</button>
          <span class="text-[10px] text-gray-300 ml-auto">Font Awesome</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ modelValue?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const open = ref(false)
const q = ref('')

// A broad set of Font Awesome Free (solid) icon names. Anything not here is still
// reachable by typing its name (the "Use …" row).
const ICONS = [
  'user', 'user-group', 'users', 'user-tie', 'user-graduate', 'user-shield', 'user-pen', 'child', 'person', 'person-running', 'person-walking', 'people-group', 'baby', 'face-smile',
  'id-badge', 'id-card', 'address-card', 'address-book', 'contact-card', 'signature', 'fingerprint', 'passport',
  'house', 'house-user', 'building', 'building-columns', 'school', 'graduation-cap', 'book', 'book-open', 'pen', 'pencil', 'note-sticky', 'clipboard', 'clipboard-list', 'list-check',
  'briefcase', 'building-user', 'sitemap', 'diagram-project', 'handshake', 'award', 'trophy', 'medal', 'ranking-star', 'star', 'crown', 'certificate',
  'heart', 'heart-pulse', 'notes-medical', 'kit-medical', 'staff-snake', 'stethoscope', 'pills', 'syringe', 'wheelchair', 'hand-holding-medical', 'truck-medical',
  'phone', 'mobile', 'envelope', 'envelopes-bulk', 'at', 'comment', 'comments', 'message', 'bell', 'paper-plane', 'inbox', 'share-nodes',
  'calendar', 'calendar-days', 'calendar-check', 'calendar-plus', 'clock', 'hourglass', 'stopwatch',
  'location-dot', 'map', 'map-location-dot', 'compass', 'globe', 'earth-oceania', 'flag', 'flag-checkered',
  'dollar-sign', 'coins', 'money-bill', 'money-bill-wave', 'credit-card', 'receipt', 'wallet', 'sack-dollar', 'file-invoice-dollar', 'chart-line', 'chart-pie', 'chart-simple', 'percent',
  'file', 'file-lines', 'file-pdf', 'file-image', 'file-arrow-up', 'file-arrow-down', 'folder', 'folder-open', 'paperclip', 'download', 'upload', 'print',
  'futbol', 'baseball', 'baseball-bat-ball', 'basketball', 'volleyball', 'football', 'table-tennis-paddle-ball', 'golf-ball-tee', 'hockey-puck', 'dumbbell', 'medal', 'stopwatch-20', 'person-swimming', 'bicycle', 'shirt', 'whistle',
  'shield', 'shield-halved', 'lock', 'unlock', 'key', 'user-lock', 'eye', 'eye-slash', 'check', 'check-double', 'circle-check', 'xmark', 'circle-xmark', 'ban',
  'gear', 'gears', 'sliders', 'wrench', 'screwdriver-wrench', 'toolbox', 'plug', 'database', 'server', 'cloud',
  'circle-info', 'circle-question', 'circle-exclamation', 'triangle-exclamation', 'lightbulb', 'bullhorn', 'thumbtack', 'tag', 'tags', 'bookmark',
  'camera', 'image', 'images', 'video', 'music', 'microphone', 'film',
  'car', 'bus', 'plane', 'train', 'ship', 'truck', 'van-shuttle',
  'utensils', 'mug-hot', 'cake-candles', 'gift', 'cart-shopping', 'basket-shopping', 'store', 'box', 'boxes-stacked',
  'sun', 'moon', 'cloud-sun', 'umbrella', 'fire', 'snowflake', 'tree', 'leaf', 'paw', 'dog', 'cat',
]

const customSlug = computed(() =>
  q.value.trim().toLowerCase().replace(/^fa[srlbd]?[ -]+/, '').replace(/^fa-/, '').replace(/[^a-z0-9-]/g, ''))

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return ICONS
  return ICONS.filter(n => n.includes(s))
})

function pick(name: string) {
  emit('update:modelValue', name ? `fa-solid fa-${name}` : '')
  open.value = false
  q.value = ''
}
</script>
