<template>
  <div
    class="border rounded-lg px-4 py-3 space-y-3 cursor-pointer transition-colors"
    :class="selected ? 'border-[#0e43a3] bg-blue-50/20' : 'border-gray-200 bg-gray-50 hover:border-gray-300'"
    @click="$emit('click')">
    <!-- Header row: radio + icon + title + optional right slot -->
    <div class="flex items-center gap-3">
      <div
        class="w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors"
        :class="selected ? 'border-[#0e43a3]' : 'border-gray-300'">
        <div v-if="selected" class="w-2 h-2 rounded-full bg-[#0e43a3]" />
      </div>
      <i :class="`pi ${icon} text-gray-400 text-sm`" />
      <span class="text-sm font-medium text-gray-700">{{ title }}</span>
      <div v-if="$slots.header" class="ml-auto" @click.stop>
        <slot name="header" />
      </div>
    </div>
    <!-- Expanded content -->
    <div v-if="selected && $slots.default" class="pl-7 space-y-2.5" @click.stop>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  selected: boolean
  icon: string
  title: string
}>()

defineEmits<{ click: [] }>()
</script>
