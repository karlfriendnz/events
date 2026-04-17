<template>
  <div class="border rounded-xl overflow-hidden transition-colors" :class="agreed ? 'border-[#0e43a3]/30' : 'border-gray-200'">
    <!-- Header row: always visible, click anywhere to expand -->
    <div
      class="flex items-center gap-3 px-4 py-3 select-none cursor-pointer"
      :class="open ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'"
      @click="open = !open">
      <!-- I agree checkbox + text on the left (checkbox click toggles agreement only) -->
      <div class="flex items-center gap-2 flex-1">
        <span
          class="w-4 h-4 border-2 rounded shrink-0 flex items-center justify-center transition-colors"
          :class="agreed ? 'border-[#0e43a3] bg-[#0e43a3]' : 'border-gray-300'"
          @click.stop="$emit('update:agreed', !agreed)">
          <i v-if="agreed" class="pi pi-check text-white text-[9px]" />
        </span>
        <span class="text-sm font-semibold transition-colors cursor-pointer" :class="agreed ? 'text-gray-700' : 'text-red-500'" @click.stop="$emit('update:agreed', !agreed)">{{ agreeText }}</span>
      </div>
      <!-- Read / Close indicator -->
      <span class="shrink-0 text-sm font-semibold px-3 py-1 rounded-lg border transition-colors"
        :class="open ? 'bg-gray-200 border-gray-200 text-gray-600' : 'border-gray-200 text-gray-500'">
        {{ open ? 'Close' : 'Read' }}
      </span>
    </div>

    <!-- Expanded body -->
    <div v-if="open" class="px-4 pb-4 pt-3 border-t border-gray-100">
      <p class="text-sm font-semibold text-gray-600 mb-2">{{ label }}</p>
      <p class="text-sm text-gray-500 leading-relaxed">
        By participating you agree to abide by the rules and conditions set out in this agreement.
        All bookings are made on a first-come, first-served basis and are subject to availability.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  label: string
  agreeText: string
  agreed: boolean
}>()

defineEmits<{
  'update:agreed': [value: boolean]
}>()

const open = ref(false)
</script>
