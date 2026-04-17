<template>
  <!-- Compact row when image is set -->
  <div v-if="modelValue" class="flex items-center gap-2 p-1.5 border border-gray-200 rounded-xl">
    <img :src="modelValue" class="flex-1 h-24 object-cover rounded-lg min-w-0" />
    <label
      class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#0e43a3] cursor-pointer transition-colors"
      title="Replace">
      <i class="pi pi-upload text-xs" />
      <input type="file" accept="image/*" class="hidden" @change="onFile" />
    </label>
    <button
      type="button"
      class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
      title="Remove"
      @click="$emit('update:modelValue', '')">
      <i class="pi pi-trash text-xs" />
    </button>
  </div>
  <!-- Upload prompt when no image -->
  <label v-else class="flex items-center gap-2.5 border border-dashed border-gray-200 rounded-xl px-3 py-2 cursor-pointer hover:border-[#0e43a3] hover:bg-blue-50/30 transition-colors">
    <i class="pi pi-upload text-gray-400 text-sm" />
    <span class="text-xs text-gray-500">{{ placeholder }}</span>
    <input type="file" accept="image/*" class="hidden" @change="onFile" />
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (ev) => emit('update:modelValue', ev.target?.result as string)
  reader.readAsDataURL(file)
}
</script>
