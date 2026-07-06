<!--
  Action gate. Renders its default slot only when the current user can perform
  `action` on `resource`, resolved through the same useCan() logic as the route
  gates — so supers always pass and the never-lock-out fallback holds. Fails OPEN:
  while perms are still loading (useCan defaults to unrestricted) the slot shows,
  then hides if the resolved grid denies it.

  Usage:
    <Can resource="groups" action="update"><Button label="Edit" /></Can>
    <Can resource="people"><NuxtLink to="/people/new">Add</NuxtLink></Can>  // action defaults to 'read'
-->
<script setup lang="ts">
import type { PermAction } from '~/composables/usePermissions'

const props = withDefaults(defineProps<{
  resource: string
  action?: PermAction
}>(), { action: 'read' })

const { can, ensureLoaded } = useCan()

onMounted(() => { ensureLoaded() })

// useCan defaults to unrestricted=true, so this is true (fail-open) until the
// grid loads and narrows it.
const allowed = computed(() => can(props.resource, props.action))
</script>

<template>
  <slot v-if="allowed" />
</template>
