<!--
  Simple "run the event" view — the landing page for a Quick event. A thin shell that
  composes reusable, self-contained components: <EventDetailsSummary> (details + inline
  edit), a two-tab body of <EventAttendance> (invitees + take attendance) and
  <EventNotesTasks>. Everything here works off the route :id — no page-level data load.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
definePageMeta({ layout: 'default' })

const route = useRoute()
const id = computed(() => route.params.id as string)
const breadcrumbs = useBreadcrumbs()
const activeTab = ref<'attendance' | 'notes'>('attendance')
void useToast() // ensure the Toast service is available to child components

// The details component owns the event; it hands us the loaded event for the breadcrumb.
function onLoaded(ev: any) {
  breadcrumbs.value = [{ label: 'Events', to: '/events' }, { label: ev?.title || 'Event' }]
}
onUnmounted(() => { breadcrumbs.value = [] })

const BODY_TABS = [
  { k: 'attendance', l: 'Attendance', i: 'pi-check-square' },
  { k: 'notes', l: 'Notes & tasks', i: 'pi-clipboard' },
]
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
    <EventDetailsSummary :event-id="id" @loaded="onLoaded" />

    <!-- Two-tab body: Attendance · Notes & tasks -->
    <div class="flex items-center gap-1 border-b border-gray-200">
      <button v-for="tb in BODY_TABS" :key="tb.k"
        class="px-4 py-2 text-sm border-b-2 -mb-px flex items-center gap-1.5 transition-colors"
        :class="activeTab === tb.k ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="activeTab = (tb.k as any)">
        <i :class="`pi ${tb.i} text-xs`" />{{ tb.l }}
      </button>
    </div>

    <div v-show="activeTab === 'attendance'">
      <EventAttendance :event-id="id" fit />
    </div>
    <div v-show="activeTab === 'notes'">
      <EventNotesTasks :event-id="id" />
    </div>
    <Toast />
  </div>
</template>
