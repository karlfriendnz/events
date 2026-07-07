<!--
  Reports hub — one page linking every reporting surface in the platform.
  Cards are grouped by area (People & classes / Money / Events / Attendance).
  Each links to the existing report page; new reports slot in as more cards.
  Module-gated: a card only shows when its module is on.
-->
<script setup lang="ts">
const { ensureTerms, t } = useTerms()
void ensureTerms()
const { isEnabled, loadModules } = useOrgModules()
void loadModules()
const cr = useCustomReports()
const customReports = ref<any[]>([])
onMounted(async () => { customReports.value = await cr.loadReports() })
watch(() => useOrg().orgId.value, async () => { customReports.value = await cr.loadReports() })
useBreadcrumbs([{ label: 'Reports' }])

const groups = computed(() => [
  {
    title: () => `${t('member', true)} & ${t('group', true, true)}`,
    module: 'groups',
    cards: [
      { name: () => `${cap(t('group', true))} report`, desc: () => `${cap(t('group', true))} per week, scheduled hours, spots filled and utilisation — overall, by location and by ${t('code', false, true)}.`, icon: 'pi-chart-bar', color: '#3B82F6', to: '/groups/reports' },
      { name: 'Retention', desc: () => `Compare two ${t('term', true, true)} — new, rejoined, transferred and remaining ${t('member', true, true)}, with CSV export.`, icon: 'pi-chart-line', color: '#10B981', to: '/groups/retention' },
    ],
  },
  {
    title: () => 'Money',
    module: 'finances',
    cards: [
      { name: 'Finances', desc: () => 'Fees, invoices and payment reporting across the club.', icon: 'pi-dollar', color: '#059669', to: '/finances' },
      { name: 'Reporting', desc: () => 'General club reporting — registrations, revenue and status breakdowns.', icon: 'pi-chart-pie', color: '#8B5CF6', to: '/reporting' },
    ],
  },
  {
    title: () => cap(t('event', true, true)),
    module: 'events',
    cards: [
      { name: () => `${cap(t('event', true, true))} reporting`, desc: () => `Analytics across your ${t('event', true, true)} — registrations, revenue and check-in rates.`, icon: 'pi-calendar', color: '#F59E0B', to: '/events/reporting' },
    ],
  },
  {
    title: () => 'Attendance',
    module: 'attendance',
    cards: [
      { name: 'Attendance', desc: () => `Upcoming sessions and rolls — open any ${t('group', false, true)}'s Trainings tab for its attendance matrix + export.`, icon: 'pi-check-square', color: '#EC4899', to: '/attendance' },
    ],
  },
])
function cap(v: string) { return v.charAt(0).toUpperCase() + v.slice(1) }
function val(v: any): string { return typeof v === 'function' ? v() : v }
const visibleGroups = computed(() => groups.value.filter(g => isEnabled(g.module)))
</script>

<template>
  <div class="p-3 sm:p-6 space-y-6">
    <div>
      <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Reports</h1>
      <p class="text-sm text-gray-500">Every reporting view in one place.</p>
    </div>

    <!-- Custom reports -->
    <div class="space-y-2.5">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-bold uppercase tracking-wide text-gray-400">Custom reports</h2>
        <NuxtLink to="/reports/custom/new" class="text-sm font-medium text-primary hover:underline"><i class="pi pi-plus text-[10px] mr-1" />New custom report</NuxtLink>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink v-for="r in customReports" :key="r.id" :to="`/reports/custom/${r.id}`" class="card p-5 flex items-start gap-3 hover:shadow-md transition-shadow">
          <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" style="background:#6366F1"><i class="pi pi-filter text-lg" /></span>
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900 truncate">{{ r.name }}</h3>
            <p class="text-xs text-gray-500 mt-1">{{ (r.config.filters || []).length }} filter{{ (r.config.filters || []).length === 1 ? '' : 's' }}</p>
          </div>
        </NuxtLink>
        <NuxtLink to="/reports/custom/new" class="card p-5 flex items-center justify-center gap-2 border-dashed text-sm text-gray-400 hover:text-primary hover:border-primary transition-colors"><i class="pi pi-plus text-xs" />Build a report</NuxtLink>
      </div>
    </div>

    <div v-for="g in visibleGroups" :key="val(g.title)" class="space-y-2.5">
      <h2 class="text-xs font-bold uppercase tracking-wide text-gray-400">{{ val(g.title) }}</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink v-for="c in g.cards" :key="val(c.name)" :to="c.to"
          class="card p-5 flex items-start gap-3 hover:shadow-md transition-shadow">
          <span class="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0" :style="{ background: c.color }">
            <i :class="['pi', c.icon, 'text-lg']" />
          </span>
          <div class="min-w-0">
            <h3 class="text-sm font-semibold text-gray-900">{{ val(c.name) }}</h3>
            <p class="text-xs text-gray-500 mt-1 leading-snug">{{ val(c.desc) }}</p>
          </div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
