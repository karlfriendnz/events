<template>
  <div class="p-6 space-y-4">
    <!-- Centered pill tabs (match venue detail page) -->
    <div class="flex justify-center">
      <div class="flex gap-2">
        <button v-for="tab in visibleTabs" :key="tab.value"
          class="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-colors"
          :class="activeTopTab === tab.value
            ? 'bg-[#1E2157] text-white shadow-sm'
            : 'bg-[rgba(30,33,90,0.06)] text-gray-600 hover:bg-[rgba(30,33,90,0.1)]'"
          @click="activeTopTab = tab.value">
          <i :class="`pi ${tab.icon} text-xs`" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <BookablesList v-if="activeTopTab === 'bookables'" />
    <BookingsList v-else-if="activeTopTab === 'bookings'" />
    <ActivitiesList v-else-if="activeTopTab === 'activities'" />
    <BookingDiscountsList v-else-if="activeTopTab === 'discounts'" />
    <AccessControlList v-else-if="activeTopTab === 'access'" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const router = useRouter()

const topTabs = [
  { label: 'Bookings',       value: 'bookings',   icon: 'pi-book',     visibleWhen: 'hasBookables' },
  { label: 'Bookables',      value: 'bookables',  icon: 'pi-building', visibleWhen: 'always' },
  { label: 'Activities',     value: 'activities', icon: 'pi-bolt',     visibleWhen: 'always' },
  { label: 'Discounts',      value: 'discounts',  icon: 'pi-tag',      visibleWhen: 'always' },
  { label: 'Access Control', value: 'access',     icon: 'pi-shield',   visibleWhen: 'always' },
]

type TopTab = 'bookings' | 'bookables' | 'activities' | 'discounts' | 'access'

const activeCount = ref<number>(0)
const bookingsCount = ref<number>(0)
const countsLoaded = ref(false)

const visibleTabs = computed(() =>
  topTabs.filter(t => {
    if (t.visibleWhen === 'hasBookables') return activeCount.value > 0
    return true
  }),
)

const activeTopTab = ref<TopTab>((route.query.tab as TopTab) || 'bookings')
const tabExplicit = !!route.query.tab

watch(activeTopTab, (tab) => {
  router.replace({ query: { ...route.query, tab } })
})

watch([activeCount, bookingsCount, countsLoaded], () => {
  if (!countsLoaded.value) return
  if (activeTopTab.value === 'bookings' && (activeCount.value === 0 || bookingsCount.value === 0)) {
    activeTopTab.value = 'bookables'
  }
})

async function loadCounts() {
  if (!orgId.value) return
  const [{ count: bookablesCount }, { count: bkCount }] = await Promise.all([
    (db.from as any)('bookables')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId.value)
      .not('status', 'in', '("DELETED","ARCHIVED")'),
    // bookings has no org_id — scope through the bookable's org with an inner join.
    (db.from as any)('bookings')
      .select('id, bookable:bookables!inner(org_id)', { count: 'exact', head: true })
      .eq('bookable.org_id', orgId.value),
  ])
  activeCount.value = bookablesCount ?? 0
  bookingsCount.value = bkCount ?? 0
  countsLoaded.value = true
  if (!tabExplicit && bookingsCount.value === 0 && activeTopTab.value === 'bookings') {
    activeTopTab.value = 'bookables'
  }
}

watch(orgId, () => loadCounts(), { immediate: true })
</script>
