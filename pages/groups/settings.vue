<!-- Groups → Settings: lands on the first group-settings screen (vertical-tab shell) -->
<script setup lang="ts">
definePageMeta({ middleware: () => navigateTo('/groups/codes', { replace: true }) })
</script>
<template><div /></template>
