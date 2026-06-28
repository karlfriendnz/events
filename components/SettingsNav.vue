<!--
  Vertical left-hand menu for the Settings area. Some items are panels within
  /settings (driven by ?tab=…), others are their own /settings/* pages
  (Permissions, Fields, Terminology). Sits in a flex row beside the page content.
-->
<script setup lang="ts">
const route = useRoute()
const tabs = [
  { label: 'General', icon: 'pi-cog', to: '/settings', tab: 'general' },
  { label: 'Bookings', icon: 'pi-calendar', to: '/settings', tab: 'bookings' },
  { label: 'Events', icon: 'pi-megaphone', to: '/settings', tab: 'events' },
  { label: 'Resources', icon: 'pi-building', to: '/settings', tab: 'resources' },
  { label: 'User type', icon: 'pi-lock', to: '/settings/permissions' },
  { label: 'Roles', icon: 'pi-users', to: '/settings/roles' },
  { label: 'Fields', icon: 'pi-id-card', to: '/settings/fields' },
  { label: 'Terminology', icon: 'pi-pencil', to: '/settings/terminology' },
  { label: 'Profile dashboard', icon: 'pi-th-large', to: '/settings/profile-dashboard' },
  { label: 'Dashboard defaults', icon: 'pi-sliders-h', to: '/settings/dashboard-defaults' },
  { label: 'Advanced', icon: 'pi-wrench', to: '/settings', tab: 'advanced' },
]
function linkTo(t: any) {
  return t.tab ? { path: t.to, query: t.tab === 'general' ? {} : { tab: t.tab } } : t.to
}
function active(t: any) {
  if (t.tab) return route.path === '/settings' && (route.query.tab || 'general') === t.tab
  return route.path === t.to
}
</script>

<template>
  <!-- Horizontal scroll strip on mobile, vertical menu on md+ -->
  <nav class="flex md:flex-col gap-1 md:gap-0.5 md:w-48 md:shrink-0 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
    <NuxtLink v-for="t in tabs" :key="t.label" :to="linkTo(t)"
      class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0"
      :class="active(t) ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'">
      <i :class="['pi', t.icon, 'text-xs w-4 text-center']" />{{ t.label }}
    </NuxtLink>
  </nav>
</template>
