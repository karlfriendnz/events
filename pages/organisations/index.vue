<!--
  Organisations directory moved INTO the People page as its "Organisations" view.
  This route forwards there (preserving any ?type= filter) so old links keep
  working. Non-async redirect (no top-level await → no Suspense hang). Entity
  records themselves live at /organisations/:id.
-->
<script setup lang="ts">
const route = useRoute()
const query: Record<string, string> = { view: 'organisations' }
if (typeof route.query.type === 'string') query.type = route.query.type
onMounted(() => navigateTo({ path: '/people', query }, { replace: true }))
</script>

<template>
  <div />
</template>
