<!--
  Member-facing "My events" — the events profile view for the logged-in user (or a
  ?person= override). Thin wrapper around <EventsProfileView>; the control bar owns
  the title via useBreadcrumbs.
-->
<script setup lang="ts">
const route = useRoute()
useBreadcrumbs([{ label: 'My events' }])
const personId = computed(() => (route.query.person as string) || undefined)
</script>

<template>
  <EventsProfileView :person-id="personId" />
</template>
