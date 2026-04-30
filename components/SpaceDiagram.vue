<template>
  <div class="relative rounded-xl overflow-hidden select-none" :class="bgClass" :style="bgStyle" style="aspect-ratio:3/2">

    <!-- Venue markings: football -->
    <div v-if="spaceType === 'football'" class="absolute inset-0 pointer-events-none">
      <div class="absolute inset-y-0 left-1/2 w-0 border-l-2 border-white/20 -translate-x-px" />
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-16 h-16 rounded-full border-2 border-white/20" />
      </div>
    </div>

    <!-- Venue markings: basketball -->
    <div v-if="spaceType === 'basketball'" class="absolute inset-0 pointer-events-none">
      <div class="absolute inset-y-0 left-1/2 w-0 border-l-2 border-white/15 -translate-x-px" />
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-16 h-16 rounded-full border-2 border-white/15" />
      </div>
    </div>

    <!-- Section overlays -->
    <div v-for="(sec, i) in sections" :key="sec"
      class="absolute transition-all duration-150"
      :class="[
        horizontal
          ? ['left-0 right-0 flex flex-row items-center justify-between px-2.5',
             i < sections.length - 1 ? 'border-b border-white/20' : '']
          : ['top-0 bottom-0 flex flex-col items-center justify-between py-2.5',
             i < sections.length - 1 ? 'border-r border-white/20' : '']
      ]"
      :style="horizontal
        ? { top: `${(i / sections.length) * 100}%`, height: `${100 / sections.length}%`, background: sectionBg(sec) }
        : { left: `${(i / sections.length) * 100}%`, width: `${100 / sections.length}%`, background: sectionBg(sec) }">

      <!-- Section label (left for horizontal, bottom for vertical) -->
      <span v-if="!compact" class="text-white text-[11px] font-semibold drop-shadow-md px-1 leading-tight"
        :class="horizontal ? 'text-left' : 'text-center order-last'">{{ sec }}</span>

      <!-- Status icon (right for horizontal, top for vertical) -->
      <div v-if="!compact" :class="horizontal ? 'flex items-center justify-center w-5' : 'flex items-center justify-center h-5'">
        <i v-if="isOccupied(sec) && isHovered(sec)"
          class="pi pi-times-circle text-white text-sm drop-shadow" title="Conflict" />
        <i v-else-if="isOccupied(sec)"
          class="pi pi-lock text-white/80 text-xs drop-shadow" />
        <i v-else-if="isHovered(sec)"
          class="pi pi-check-circle text-white text-sm drop-shadow" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!sections.length" class="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
      No sections defined
    </div>

    <!-- Legend -->
    <div v-if="showLegend && (occupiedSections?.length || hoveredSections?.length)" class="absolute bottom-2 right-2 flex gap-1.5">
      <span v-if="occupiedSections?.length" class="flex items-center gap-1 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
        <span class="w-2 h-2 rounded-full bg-red-400 inline-block" /> Booked
      </span>
      <span v-if="hoveredSections?.length" class="flex items-center gap-1 bg-black/40 text-white text-[10px] px-1.5 py-0.5 rounded-full">
        <span class="w-2 h-2 rounded-full bg-indigo-400 inline-block" /> This layout
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  sections: string[]
  spaceType?: string
  occupiedSections?: string[]
  hoveredSections?: string[]
  showLegend?: boolean
  compact?: boolean
}>()

const horizontal = computed(() => props.spaceType === 'pool')

const bgClass = computed(() => {
  switch (props.spaceType) {
    case 'football':   return 'bg-green-700'
    case 'basketball': return 'bg-amber-700'
    case 'pool':       return 'bg-blue-600'
    case 'hall':       return 'bg-stone-300'
    default:           return 'bg-slate-400'
  }
})

const bgStyle = computed(() => {
  switch (props.spaceType) {
    case 'football':
      return 'background-image: repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(0,0,0,0.07) 40px, rgba(0,0,0,0.07) 80px)'
    case 'pool':
      return 'background-image: repeating-linear-gradient(180deg, transparent, transparent 24px, rgba(255,255,255,0.12) 24px, rgba(255,255,255,0.12) 26px)'
    default:
      return ''
  }
})

function isOccupied(sec: string) {
  return props.occupiedSections?.includes(sec) ?? false
}

function isHovered(sec: string) {
  return props.hoveredSections?.includes(sec) ?? false
}

function sectionBg(sec: string) {
  const occupied = isOccupied(sec)
  const hovered  = isHovered(sec)
  const anyHover = (props.hoveredSections?.length ?? 0) > 0

  if (occupied && hovered) return 'rgba(239,68,68,0.85)'
  if (occupied)            return 'rgba(239,68,68,0.65)'
  if (hovered)             return props.compact
    ? 'rgba(255,255,255,0.30)'   // brighten the venue colour in card view
    : 'rgba(99,102,241,0.65)'    // indigo in editor/full view
  if (anyHover)            return props.compact
    ? 'rgba(0,0,0,0.45)'         // darken non-selected in card view
    : 'rgba(0,0,0,0.38)'
  return 'rgba(34,197,94,0.22)'
}
</script>
