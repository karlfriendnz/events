<template>
  <div class="flex-1 overflow-y-auto px-3 py-3 space-y-1">
    <button v-for="s in sections" :key="s.id" type="button"
      class="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl border transition-all text-left group"
      :class="s.complete
        ? 'border-green-100 bg-green-50/30 hover:bg-green-50/60'
        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'"
      @click="$emit('select', s.id)">
      <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        :class="s.complete ? 'bg-green-100' : 'bg-gray-100 group-hover:bg-gray-200'">
        <i class="pi text-sm" :class="[s.icon, s.complete ? 'text-green-600' : 'text-gray-500']" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-800">{{ s.label }}</p>
        <p class="text-xs mt-0.5" :class="s.complete ? 'text-green-500' : 'text-gray-400'">
          {{ s.subtitle ?? (s.complete ? 'Saved' : 'Not configured') }}
        </p>
      </div>
      <i class="pi text-sm shrink-0"
        :class="s.complete ? 'pi-check-circle text-green-500' : 'pi-chevron-right text-gray-300'" />
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  sections: {
    id: string
    label: string
    icon: string
    complete: boolean
    subtitle?: string | null
  }[]
}>()
defineEmits<{ (e: 'select', id: string): void }>()
</script>
