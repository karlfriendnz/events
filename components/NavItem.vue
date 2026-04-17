<template>
  <NuxtLink
    :to="item.href"
    class="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors"
    :class="isActive
      ? 'bg-primary-50 text-primary-700 font-medium'
      : 'text-surface-500 hover:text-surface-800 hover:bg-surface-100'"
  >
    <i :class="`pi ${item.icon} text-sm`" />
    {{ item.label }}
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{
  item: { href: string; label: string; icon: string }
}>()
const route = useRoute()
const isActive = computed(() => route.path.startsWith(props.item.href))
</script>
