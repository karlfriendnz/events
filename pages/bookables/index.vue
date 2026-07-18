<template>
  <div class="p-3 sm:p-6 space-y-4">
    <!-- Centered pill tabs (match venue detail page) -->
    <div class="flex md:justify-center overflow-x-auto -mx-1 px-1 no-scrollbar">
      <div class="flex gap-2">
        <button v-for="tab in visibleTabs" :key="tab.value"
          class="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition-colors shrink-0 whitespace-nowrap"
          :class="activeTopTab === tab.value
            ? 'bg-primary text-white shadow-sm'
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

const api = useBookingsApi()
const { orgId } = useOrg()
const route = useRoute()
const router = useRouter()

const topTabs = [
  { label: 'Bookables',      value: 'bookables',  icon: 'pi-building', visibleWhen: 'always' },
  { label: 'Bookings',       value: 'bookings',   icon: 'pi-book',     visibleWhen: 'hasBookables' },
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

const activeTopTab = ref<TopTab>((route.query.tab as TopTab) || 'bookables')

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
  // The tabs only gate on presence (>0), so count the active bookables and probe for
  // at least one booking through the seam (bookings are org-scoped via their bookable).
  const [bks, someBooking] = await Promise.all([
    api.bookables(orgId.value),
    api.bookings(orgId.value, { limit: 1 }),
  ])
  activeCount.value = bks.filter(b => b.status !== 'DELETED' && b.status !== 'ARCHIVED').length
  bookingsCount.value = someBooking.length
  countsLoaded.value = true
}

watch(orgId, () => loadCounts(), { immediate: true })
</script>
