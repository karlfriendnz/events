<!--
  Vertical left-hand menu for the Settings area. Some items are panels within
  /settings (driven by ?tab=…), others are their own /settings/* pages
  (Permissions, Fields, Terminology). Sits in a flex row beside the page content.
-->
<script setup lang="ts">
const route = useRoute()
const orgApi = useOrganisationsApi()
const { orgId } = useOrg()

// Disciplines are a governing-body (NSO/Regional/Association) concept — show that
// menu item only for non-club orgs.
const isGoverning = ref(false)
// Clubs waiting on this body to say yes — a request nobody sees is the same as no
// request at all, which is how affiliation stayed one-sided for so long.
const pendingAffiliations = ref(0)
watch(orgId, async () => {
  if (!orgId.value) { isGoverning.value = false; pendingAffiliations.value = 0; return }
  const profile = await orgApi.getProfile(orgId.value)
  isGoverning.value = !!profile?.orgLevel && profile.orgLevel !== 'CLUB'
  pendingAffiliations.value = isGoverning.value ? await useAffiliations().pendingCountForBody(orgId.value) : 0
}, { immediate: true })

const tabs = computed(() => [
  { label: 'General', icon: 'pi-cog', to: '/settings', tab: 'general' },
  { label: 'People & Entities', icon: 'pi-id-card', to: '/settings/fields' },
  { label: 'Fields', icon: 'pi-list', to: '/settings/field-catalogue' },
  ...(isGoverning.value ? [
    { label: 'Disciplines', icon: 'pi-tags', to: '/disciplines' },
    // A body's register of its own clubs + the approval queue (mig 273).
    { label: 'Clubs', icon: 'pi-sitemap', to: '/settings/affiliations', badge: pendingAffiliations.value || undefined },
  ] : []),
  { label: 'Registration forms', icon: 'pi-file-edit', to: '/forms' },
  { label: 'Integrations', icon: 'pi-link', to: '/settings/integrations' },
  { label: 'Club setup', icon: 'pi-sliders-v', to: '/settings/modules' },
  { label: 'Sports & locations', icon: 'pi-map-marker', to: '/settings/locations' },
  { label: 'Terminology', icon: 'pi-pencil', to: '/settings/terminology' },
  { label: 'Advanced', icon: 'pi-wrench', to: '/settings', tab: 'advanced' },
  { label: 'Admin', icon: 'pi-file', to: '/fm-invoices' },
  // Module-specific settings live below the divider
  { divider: true },
  { label: 'Events', icon: 'pi-megaphone', to: '/settings', tab: 'events' },
  { label: 'Bookings', icon: 'pi-calendar', to: '/settings', tab: 'bookings' },
  { label: 'Financials', icon: 'pi-wallet', to: '/settings', tab: 'financials' },
])
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
    <template v-for="(t, i) in tabs" :key="t.label ?? `div-${i}`">
      <div v-if="t.divider" class="hidden md:block border-t border-gray-200 my-2" />
      <NuxtLink v-else :to="linkTo(t)"
        class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0"
        :class="active(t) ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'">
        <i :class="['pi', t.icon, 'text-xs w-4 text-center']" />{{ t.label }}
        <span v-if="t.badge" class="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          :class="active(t) ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'">{{ t.badge }}</span>
      </NuxtLink>
    </template>
  </nav>
</template>
