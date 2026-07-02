<!--
  /groups/classes → /groups. The Groups landing IS the Classes view now, so this
  legacy path just redirects (keeps old links + the nav flyout working).
-->
<script setup lang="ts">
await navigateTo('/groups', { replace: true })
</script>

<template>
  <div />
</template>
