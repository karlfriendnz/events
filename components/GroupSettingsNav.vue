<!--
  Vertical left-hand menu for the GROUP SETTINGS area (mirrors <SettingsNav>).
  Sits beside the page content on each group-config screen (codes, default
  roles, views, rollover). Terms links out to the club-level terms page.
-->
<script setup lang="ts">
const route = useRoute()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const tabs = computed(() => [
  { label: `Organise ${t('code', true)}`, icon: 'pi-sitemap', to: '/groups/codes' },
  { label: 'Default roles', icon: 'pi-shield', to: '/groups/codes/default-roles' },
  { label: 'Manage views', icon: 'pi-th-large', to: '/groups/views' },
  { label: `${cap(t('term', true))}`, icon: 'pi-clock', to: '/settings/terms' },
  { label: `Roll over a ${t('term', false, true)}`, icon: 'pi-copy', to: '/groups/rollover' },
])
function cap(v: string) { return v.charAt(0).toUpperCase() + v.slice(1) }
function active(to: string) {
  return route.path === to || (to !== '/groups/codes' && route.path.startsWith(to))
    // /groups/codes should stay active on its own page but not on default-roles
    || (to === '/groups/codes' && route.path === '/groups/codes')
}
</script>

<template>
  <nav class="flex md:flex-col gap-1 md:gap-0.5 md:w-52 md:shrink-0 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mx-1 px-1 md:mx-0 md:px-0">
    <p class="hidden md:block text-[11px] font-bold uppercase tracking-wide text-gray-400 px-3 pb-1">{{ cap(t('group', true)) }} settings</p>
    <NuxtLink v-for="tb in tabs" :key="tb.to" :to="tb.to"
      class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0"
      :class="active(tb.to) ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'">
      <i :class="['pi', tb.icon, 'text-xs w-4 text-center']" />{{ tb.label }}
    </NuxtLink>
  </nav>
</template>
