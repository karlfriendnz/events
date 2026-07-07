<!--
  Renders the effective audience of a resource/folder as a compact one-line row of
  chips. Groups show a colour dot; person types are plain. "Everyone" when nothing is
  connected anywhere up the chain; an "inherited" tint + tooltip when the audience
  comes from a parent folder rather than the item itself.
-->
<script setup lang="ts">
const props = defineProps<{
  audience: { chips: { label: string; color: string | null }[]; inherited: boolean; everyone: boolean }
  max?: number
}>()

const max = computed(() => props.max ?? 3)
const shown = computed(() => props.audience.chips.slice(0, max.value))
const extra = computed(() => Math.max(0, props.audience.chips.length - max.value))
const allLabels = computed(() => props.audience.chips.map(c => c.label).join(', '))
</script>

<template>
  <span class="inline-flex items-center gap-1 flex-wrap"
    v-tooltip.top="audience.inherited ? `Inherited from folder: ${allLabels}` : ''">
    <span v-if="audience.everyone"
      class="inline-flex items-center px-2 h-5 rounded-full text-xs bg-gray-100 text-gray-400">
      Everyone
    </span>
    <template v-else>
      <i v-if="audience.inherited" class="pi pi-arrow-down-left text-gray-300" style="font-size:9px" />
      <span v-for="(c, i) in shown" :key="i"
        class="inline-flex items-center gap-1 px-2 h-5 rounded-full text-xs border"
        :class="audience.inherited ? 'bg-gray-50 border-gray-100 text-gray-400' : 'bg-white border-gray-200 text-gray-600'">
        <span v-if="c.color" class="w-2 h-2 rounded-full" :style="{ background: c.color }" />
        {{ c.label }}
      </span>
      <span v-if="extra"
        class="inline-flex items-center px-1.5 h-5 rounded-full text-xs bg-gray-100 text-gray-500">
        +{{ extra }}
      </span>
    </template>
  </span>
</template>
