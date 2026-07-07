<!--
  Groups → Settings. A hub for the club-wide CONFIGURATION of classes/groups —
  the screens that shape how groups work (codes, saved views, roles, terms,
  rollover), separate from the day-to-day operational tools (Classes board,
  Week view, Allocate, Waitlists) which stay in the Classes flyout.
-->
<script setup lang="ts">
const { ensureTerms, t } = useTerms()
void ensureTerms()
useBreadcrumbs([{ label: () => t('group', true), to: '/groups' }, { label: 'Settings' }])

function cap(v: string) { return v.charAt(0).toUpperCase() + v.slice(1) }
const cards = computed(() => [
  { name: () => `Organise ${t('code', true, true)}`, desc: () => `Build the ${t('code', false, true)} hierarchy — drag ${t('code', true, true)} inside each other, set terms, roles and positions.`, icon: 'pi-sitemap', color: '#3B82F6', to: '/groups/codes' },
  { name: 'Default roles', desc: () => `The org-wide staff roles + member positions every ${t('code', false, true)} inherits.`, icon: 'pi-shield', color: '#8B5CF6', to: '/groups/codes/default-roles' },
  { name: 'Manage views', desc: () => `Saved ${t('group', false, true)}-board views — pick columns and which ${t('code', true, true)} appear as tabs.`, icon: 'pi-th-large', color: '#0EA5E9', to: '/groups/views' },
  { name: () => cap(t('term', true)), desc: () => `${cap(t('term', true))} & sign-up windows — the shared date ranges your ${t('group', true, true)} run in.`, icon: 'pi-clock', color: '#059669', to: '/settings/terms' },
  { name: () => `Roll over a ${t('term', false, true)}`, desc: () => `Clone a ${t('term', false, true)}'s ${t('group', true, true)} into the next one — carry coaches, members, fees.`, icon: 'pi-copy', color: '#D97706', to: '/groups/rollover' },
])
</script>

<template>
  <div class="p-3 sm:p-6 space-y-5">
    <div>
      <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ cap(t('group', true)) }} settings</h1>
      <p class="text-sm text-gray-500">Configure how your {{ t('group', true, true) }} work.</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
      <NuxtLink v-for="c in cards" :key="c.to" :to="c.to"
        class="card p-5 flex items-start gap-3 hover:shadow-md transition-shadow">
        <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" :style="{ background: c.color }">
          <i :class="['pi', c.icon, 'text-lg']" />
        </span>
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-gray-900">{{ typeof c.name === 'function' ? c.name() : c.name }}</h3>
          <p class="text-xs text-gray-500 mt-1 leading-snug">{{ c.desc() }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
