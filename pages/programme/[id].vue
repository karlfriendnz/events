<script setup lang="ts">
// The programme dates/availability view now lives INSIDE the event editor as a tab.
// Keep this route as a redirect so old links + bookmarks land in the right place.
const route = useRoute()
await navigateTo(`/events/${route.params.id}?tab=dates`, { replace: true })
</script>

<template><div /></template>
