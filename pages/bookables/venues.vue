<!-- Venues — the bookable places (split out of /bookables per the left-menu dropdown) -->
<script setup lang="ts">
const { ensureTerms, t } = useTerms()
void ensureTerms()
useBreadcrumbs([{ label: () => t('booking', true) }, { label: () => t('venue', true) }])
</script>
<template>
  <div class="p-3 sm:p-6">
    <BookablesList fixed-tab="VENUE" />
  </div>
</template>
