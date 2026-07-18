<template>
  <!-- h-screen (not min-h-screen): the month grid sizes its rows off the parent's
       height, so a min-height leaves it with nothing to divide and the weeks
       collapse to slivers. The iframe's own height is what sets the scale. -->
  <div class="h-screen bg-white p-3 sm:p-4 flex flex-col" :style="{ '--embed-accent': accent }">
    <div v-if="error" class="flex-1 flex items-center justify-center text-center text-gray-400 text-sm">
      {{ error }}
    </div>

    <template v-else>
      <!-- Toolbar -->
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-1 min-w-0">
          <button type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500" @click="step(-1)">
            <i class="pi pi-chevron-left text-xs" />
          </button>
          <span class="text-sm font-semibold text-gray-800 min-w-32 text-center truncate">{{ title }}</span>
          <button type="button" class="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-500" @click="step(1)">
            <i class="pi pi-chevron-right text-xs" />
          </button>
          <button type="button"
            class="ml-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            @click="calDate = new Date()">Today</button>
        </div>
        <div class="flex items-center gap-1">
          <button v-for="v in VIEWS" :key="v.value" type="button"
            class="px-2.5 py-1 text-xs rounded-lg border transition-colors"
            :class="view === v.value
              ? 'text-white border-transparent'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
            :style="view === v.value ? { background: accent } : undefined"
            @click="view = v.value">{{ v.label }}</button>
        </div>
      </div>

      <div class="flex-1 border border-gray-200 rounded-xl overflow-hidden" style="min-height:0">
        <BookingsCalendar :cal-date="calDate" :cal-view="view" :custom-events="calItems"
          @booking-click="openEvent" />
      </div>

      <p v-if="!loading && !calItems.length" class="text-center text-xs text-gray-400 py-2 shrink-0">
        No published events to show yet.
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
// PUBLIC embed — a club drops this in an <iframe> on its own website.
//
// Read-only and PUBLISHED-only by construction: a draft or cancelled event must
// never leak onto a public page, so status is hardcoded here rather than taken
// from the query (which anyone could edit). Everything else — which venues,
// which calendars, which event types, the starting view — is passed by the
// snippet the club copies out of /events → Calendar settings → Export.
definePageMeta({ layout: 'embed' })

const route = useRoute()
// PUBLIC website-embed calendar (layout `embed`, allow-listed for anonymous access).
// Its reads go through the PUBLIC seam — /api/v1/public/** — the one anonymous surface.
// The published/public/dated gate lives in the repo (never taken from the query).
const publicApi = usePublicApi()

const orgId = computed(() => (route.query.org as string) ?? '')
const csv = (key: string) => String(route.query[key] ?? '').split(',').filter(Boolean)

const VIEWS = [
  { label: 'Month', value: 'month' as const },
  { label: 'Week', value: 'week' as const },
  { label: 'List', value: 'list' as const },
]
const view = ref<'month' | 'week' | 'list'>(
  (['month', 'week', 'list'].includes(route.query.view as string) ? route.query.view : 'month') as any,
)
const calDate = ref(new Date())
const loading = ref(true)
const error = ref('')
const events = ref<any[]>([])
const accent = ref('#1E2157')

const title = computed(() =>
  calDate.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
)

function step(dir: number) {
  const d = new Date(calDate.value)
  if (view.value === 'month') d.setMonth(d.getMonth() + dir)
  else d.setDate(d.getDate() + dir * 7)
  calDate.value = d
}

const calItems = computed(() =>
  events.value.map(e => ({
    id: e.id,
    start_at: e.startAt,
    end_at: e.endAt,
    is_all_day: e.isAllDay ?? false,
    status: 'CONFIRMED',
    notes: e.title,
    color: e.categoryColor ?? accent.value,
    event: { id: e.id, title: e.title },
    contact_name: null,
    activity_mode: null,
    extendedProps: e,
  })),
)

// A visitor clicking an event goes to its public registration page — but only
// when one exists. Without a form there is nothing public to show them, so the
// click is a no-op rather than a dead end.
function openEvent(item: any) {
  const e = item.extendedProps
  if (!e?.formId) return
  window.open(`/r/event/${e.id}`, '_blank', 'noopener')
}

async function load() {
  if (!orgId.value) {
    error.value = 'This calendar is missing its organisation — check the embed code.'
    loading.value = false
    return
  }

  try {
    // The venue/category(calendar)/type narrowing is applied SERVER-SIDE now — the
    // internal fields those filters key off (bookable_id, locations, style) never
    // leave the public seam.
    const [org, evs] = await Promise.all([
      publicApi.org(orgId.value).catch(() => null),
      publicApi.events(orgId.value, { venues: csv('venues'), categories: csv('calendars'), types: csv('types') }),
    ])
    if (org?.brandColor) accent.value = org.brandColor
    events.value = evs
  } catch {
    error.value = "This calendar couldn't be loaded."
  }
  loading.value = false
}

onMounted(load)
</script>
