<!--
  The form's section checklist.

  Two states, and both have to be READABLE AT A GLANCE, because this list is the
  only thing standing between a half-configured form and a registrant hitting it:

    done      green — border, tint, tick
    outstanding  RED — border, tint, dot, "Not set up yet"

  Outstanding used to be plain grey, which reads as "ordinary row" rather than
  "unfinished": you had to compare every row against every other to see what was
  left. Red is the point — these are the ones blocking Form complete.
-->
<template>
  <div class="flex-1 overflow-y-auto px-3 py-3 space-y-1">
    <button v-for="s in sections" :key="s.id" type="button"
      class="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl border transition-all text-left group"
      :class="s.complete
        ? 'border-green-100 bg-green-50/30 hover:bg-green-50/60'
        : 'border-red-200 bg-red-50/40 hover:bg-red-50/70'"
      @click="$emit('select', s.id)">
      <div class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
        :class="s.complete ? 'bg-green-100' : 'bg-red-100'">
        <i class="pi text-sm" :class="[s.icon, s.complete ? 'text-green-600' : 'text-red-500']" />
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold text-gray-800">{{ s.label }}</p>
        <!-- The subtitle stays quiet grey: the row's red border, tint and icon
             already carry the state, and repeating it in red bold text made the
             unfinished rows shout three times over. -->
        <p class="text-xs mt-0.5" :class="s.complete ? 'text-green-500' : 'text-gray-400'">
          {{ s.subtitle ?? (s.complete ? 'Saved' : 'Not set up yet') }}
        </p>
      </div>
      <i class="pi text-sm shrink-0"
        :class="s.complete ? 'pi-check-circle text-green-500' : 'pi-exclamation-circle text-red-400'" />
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
