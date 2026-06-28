<!-- Placeholder for old-platform modules not yet rebuilt. Linked from the club menu. -->
<script setup lang="ts">
defineProps<{ title: string; icon?: string; note?: string }>()
</script>

<template>
  <div class="min-h-full flex flex-col items-center justify-center p-6 sm:p-12 text-center">
    <div class="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
      <i :class="['pi', icon || 'pi-clock', 'text-2xl text-primary']" />
    </div>
    <h1 class="text-xl font-semibold text-gray-900">{{ title }}</h1>
    <p class="text-sm text-gray-500 mt-1.5 max-w-sm">{{ note || 'This module is part of the platform rebuild and isn’t available yet.' }}</p>
    <span class="mt-4 text-[11px] font-bold uppercase tracking-widest text-primary/60 bg-primary/10 rounded-full px-3 py-1">Coming soon</span>
  </div>
</template>
