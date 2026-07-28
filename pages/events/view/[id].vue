<!--
  Simple "run the event" view — the landing page for a Quick event. A thin shell that
  composes reusable, self-contained components: <EventDetailsSummary> (details + inline
  edit), a two-tab body of <EventAttendance> (invitees + take attendance) and
  <EventNotesTab>. Everything here works off the route :id — no page-level data load.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => route.params.id as string)
// `?session=` opens the roll on one session of a multi-date event — the programme
// Dates list links straight to the date you clicked. Reactive, so following another
// date from the same page switches the roll rather than needing a reload.
const sessionId = computed(() => (route.query.session as string) || null)
const breadcrumbs = useBreadcrumbs()
const activeTab = ref<'attendance' | 'communication' | 'notes'>('attendance')
void useToast() // ensure the Toast service is available to child components

// Lazy-mount the body tabs: only the tab you've opened fetches + renders. Mounting all
// three at once made this the heaviest page in the app (three data loads on open) and
// could tip a loaded machine's renderer over. Once opened a tab stays mounted (v-show)
// so re-visiting doesn't refetch.
const opened = reactive(new Set<string>(['attendance']))
function openTab(k: 'attendance' | 'communication' | 'notes') { activeTab.value = k; opened.add(k) }

// The details component owns the event; it hands us the loaded event for the breadcrumb.
function onLoaded(ev: any) {
  breadcrumbs.value = [{ label: 'Events', to: '/events' }, { label: ev?.title || 'Event' }]
}
onUnmounted(() => { breadcrumbs.value = [] })

const BODY_TABS = [
  { k: 'attendance', l: 'Attendance', i: 'pi-check-square' },
  { k: 'communication', l: 'Communication', i: 'pi-envelope' },
  { k: 'notes', l: 'Notes & tasks', i: 'pi-clipboard' },
]
</script>

<template>
  <!-- 1200px, matching the Quick event modal that creates these — the roll carries
       Age / Gender / Phone / sign-in columns and 1024px (max-w-5xl) crowded them. -->
  <div class="p-3 sm:p-6 max-w-[1200px] mx-auto">
    <EventDetailsSummary class="block mb-4" :event-id="id" @loaded="onLoaded"
      @deleted="navigateTo('/events')"
      @duplicated="(newId) => navigateTo(`/events/view/${newId}`)" />

    <!-- Two-tab body: Attendance · Notes & tasks. No space-y so the tabs sit directly
         above the content (removes the gap under the tab strip). -->
    <div class="flex items-center gap-1 border-b border-gray-200">
      <button v-for="tb in BODY_TABS" :key="tb.k"
        class="px-4 py-2 text-sm border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
        :class="activeTab === tb.k ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="openTab(tb.k as any)">
        <i :class="`pi ${tb.i} text-xs`" />{{ tb.l }}
      </button>
    </div>

    <!-- One shared `pt-4` on every panel so each tab's content clears the strip by the
         same amount — the gap belongs to the tab shell, not to each tab's component. -->
    <div v-show="activeTab === 'attendance'" class="pt-4">
      <!-- No `fit`: let the roll grow to its content so the PAGE is the only scroller
           (fit caps the table's own height, which produced a second scrollbar). -->
      <EventAttendance v-if="opened.has('attendance')" :event-id="id" :session-id="sessionId" />
    </div>
    <div v-show="activeTab === 'communication'" class="pt-4">
      <EventCommunication v-if="opened.has('communication')" :event-id="id" />
    </div>
    <div v-show="activeTab === 'notes'" class="pt-4">
      <EventNotesTab v-if="opened.has('notes')" :event-id="id" />
    </div>
    <Toast />
  </div>
</template>
