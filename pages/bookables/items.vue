<!-- Items — bookable equipment/rentals (split out of /bookables) -->
<script setup lang="ts">
const { ensureTerms, t } = useTerms()
void ensureTerms()
useBreadcrumbs([{ label: () => t('booking', true) }, { label: 'Items' }])
</script>
<template>
  <div class="p-3 sm:p-6">
    <BookablesList fixed-tab="ITEM" />
  </div>
</template>
