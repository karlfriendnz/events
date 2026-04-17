<template>
  <button
    type="button"
    class="w-full flex items-center gap-3 px-3 py-3 rounded-xl border transition-all text-left"
    :class="selected
      ? 'bg-[#1E2157]/5 border-[#1E2157]/20 shadow-sm'
      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/60'"
    @click="$emit('click')">
    <div
      class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
      :class="group.noRegistrations ? 'bg-orange-50' : group.complete ? 'bg-green-50' : 'bg-red-50'">
      <i
        class="pi text-base"
        :class="group.noRegistrations ? 'pi-ban text-orange-400' : group.complete ? 'pi-check text-green-500' : 'pi-exclamation-circle text-red-400'" />
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-gray-800 truncate">{{ group.name }}</p>
      <p class="text-xs mt-0.5" :class="group.noRegistrations ? 'text-orange-400' : group.complete ? 'text-green-500' : 'text-gray-400'">
        {{ group.noRegistrations ? 'No registrations' : group.complete ? 'Complete' : `${group.filledCount} of ${group.totalCount} sections saved` }}
      </p>
    </div>
    <div v-if="!group.noRegistrations && !group.complete" class="shrink-0 flex flex-col items-end gap-1">
      <span class="text-xs font-bold text-gray-400">{{ group.filledCount }}/{{ group.totalCount }}</span>
      <div class="w-12 h-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          class="h-full rounded-full bg-[#1ab4e8] transition-all"
          :style="`width:${group.totalCount ? (group.filledCount / group.totalCount) * 100 : 0}%`" />
      </div>
    </div>
    <i v-else class="pi pi-chevron-right text-gray-300 text-xs shrink-0" />
  </button>
</template>

<script setup lang="ts">
export interface FormGroup {
  id: string
  name: string
  noRegistrations: boolean
  complete: boolean
  filledCount: number
  totalCount: number
}

defineProps<{
  group: FormGroup
  selected: boolean
}>()

defineEmits<{ click: [] }>()
</script>
