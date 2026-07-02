<!--
  InlineChips — a one-line row of small chips (roles / positions / …). Anything
  past `max` collapses into a "+N" badge whose tooltip lists the full set, so the
  cell never wraps to a second row. Presentational only.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{ items: string[]; max?: number; variant?: 'gray' | 'blue' | 'green' }>(), {
  max: 2, variant: 'gray',
})
const shown = computed(() => props.items.slice(0, props.max))
const overflow = computed(() => props.items.slice(props.max))
const chipClass = computed(() => ({
  gray: 'bg-gray-100 text-gray-600',
  blue: 'bg-[#1976d2]/10 text-[#1976d2]',
  green: 'bg-emerald-50 text-emerald-700',
}[props.variant]))
</script>

<template>
  <div class="flex items-center gap-1 whitespace-nowrap">
    <span v-if="!items.length" class="text-gray-300">—</span>
    <span v-for="c in shown" :key="c" class="text-[10px] px-1.5 py-0.5 rounded-full font-medium" :class="chipClass">{{ c }}</span>
    <span v-if="overflow.length" v-tooltip.top="items.join(', ')"
      class="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-200 text-gray-600 cursor-default">+{{ overflow.length }}</span>
  </div>
</template>
