<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()

onMounted(() => {
  const search = new URLSearchParams({ tab: 'bookings' })
  for (const [k, v] of Object.entries(route.query)) {
    if (typeof v === 'string' && k !== 'tab') search.set(k, v)
  }
  navigateTo(`/bookables?${search.toString()}`, { replace: true })
})
</script>

<template>
  <div class="p-12 text-center text-sm text-gray-400">Redirecting…</div>
</template>
