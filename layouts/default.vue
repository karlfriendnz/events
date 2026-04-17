<template>
  <div class="flex h-screen overflow-hidden" style="background:#F5F8FA">
    <!-- Narrow icon-only sidebar -->
    <aside
      class="w-14 shrink-0 flex flex-col items-center py-3 gap-1 z-20"
      style="background: linear-gradient(180deg, #1E2157 0%, #21278E 100%)"
    >
      <!-- Logo mark -->
      <div class="mb-3 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
        <i class="pi pi-calendar text-white text-sm" />
      </div>

      <!-- Events nav item with hover flyout -->
      <div
        class="relative"
        @mouseenter="onEventsEnter"
        @mouseleave="onEventsLeave"
      >
        <NuxtLink
          to="/events"
          class="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
          :class="isActive('/events') ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'"
        >
          <i class="pi pi-calendar text-lg" />
        </NuxtLink>

        <!-- Flyout panel -->
        <div
          v-show="eventsHover"
          class="absolute left-full top-0 z-50"
          style="padding-left:10px"
          @mouseenter="onEventsEnter"
          @mouseleave="onEventsLeave"
        >
          <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="width:220px">
            <!-- View Events -->
            <NuxtLink
              to="/events"
              class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              @click="eventsHover = false"
            >
              <i class="pi pi-calendar text-gray-400 text-xs" />
              View Events
            </NuxtLink>

            <!-- Calendar list -->
            <template v-if="calendars.length">
              <div class="border-t border-gray-100" />
              <div class="py-1">
                <NuxtLink
                  v-for="cal in calendars"
                  :key="cal.id"
                  :to="`/events?calendar=${cal.id}`"
                  class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  @click="eventsHover = false"
                >
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: cal.color ?? '#94a3b8' }" />
                  {{ cal.name }}
                </NuxtLink>
              </div>
            </template>

            <!-- New Category -->
            <div class="border-t border-gray-100" />
            <button
              class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              @click="openNewCalendarModal"
            >
              <i class="pi pi-plus text-gray-400 text-xs" />
              New Category
            </button>
          </div>
        </div>
      </div>

      <!-- Other nav icons -->
      <NuxtLink
        v-for="item in navItems"
        :key="item.href"
        :to="item.href"
        class="group relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
        :class="isActive(item.href)
          ? 'bg-white/20 text-white'
          : 'text-white/50 hover:bg-white/10 hover:text-white'"
      >
        <i :class="`pi ${item.icon} text-lg`" />
        <!-- Tooltip -->
        <span
          class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow"
        >
          {{ item.label }}
        </span>
      </NuxtLink>

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- Settings at bottom -->
      <NuxtLink
        to="/settings"
        class="group relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
        :class="isActive('/settings')
          ? 'bg-white/20 text-white'
          : 'text-white/50 hover:bg-white/10 hover:text-white'"
      >
        <i class="pi pi-cog text-lg" />
        <span
          class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow"
        >
          Settings
        </span>
      </NuxtLink>

      <!-- Avatar -->
      <div class="mt-2 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors">
        <i class="pi pi-user text-white text-sm" />
      </div>
    </aside>

    <!-- Right panel: top bar + page content -->
    <div class="flex flex-col flex-1 min-w-0">
      <!-- Top header bar -->
      <header class="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-6 gap-4 z-10">
        <div class="flex items-center gap-2 flex-1">
          <h1 class="text-base font-semibold text-gray-900">{{ pageTitle }}</h1>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <i class="pi pi-bell text-gray-400" />
          <span class="hidden sm:block">Demo Club</span>
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto">
        <slot />
      </main>
      <Toast />
    </div>
  </div>

</template>

<script setup lang="ts">
const route = useRoute()
const db = useSupabaseClient()

// ---- Calendars ----
const calendars = ref<{ id: string; name: string; color: string | null }[]>([])

async function loadCalendars() {
  const { data } = await db.from('categories').select('id, name, color').order('name')
  calendars.value = data ?? []
}

onMounted(loadCalendars)

// Reload when a new calendar is created via the settings modal
const calSettingsOpen = useCalendarSettingsOpen()
watch(calSettingsOpen, (open) => {
  if (!open) loadCalendars()
})

// ---- Events flyout ----
const eventsHover = ref(false)
let eventsLeaveTimer: ReturnType<typeof setTimeout> | null = null

function onEventsEnter() {
  if (eventsLeaveTimer) { clearTimeout(eventsLeaveTimer); eventsLeaveTimer = null }
  eventsHover.value = true
}

function onEventsLeave() {
  eventsLeaveTimer = setTimeout(() => {
    eventsHover.value = false
  }, 180)
}

function openNewCalendarModal() {
  eventsHover.value = false
  calSettingsOpen.value = true
}

// ---- Nav ----
const navItems = [
  { href: '/bookings', label: 'Bookings', icon: 'pi-book' },
  { href: '/bookables', label: 'Bookables', icon: 'pi-building' },
  { href: '/finances', label: 'Finances', icon: 'pi-credit-card' },
  { href: '/registration', label: 'Registration', icon: 'pi-clipboard' },
  { href: '/access', label: 'Access Control', icon: 'pi-shield' },
  { href: '/reporting', label: 'Reporting', icon: 'pi-chart-bar' },
]

const pageTitles: Record<string, string> = {
  '/events': 'Events',
  '/bookings': 'Bookings',
  '/bookables': 'Bookables',
  '/finances': 'Finances',
  '/registration': 'Registration',
  '/access': 'Access Control',
  '/reporting': 'Reporting',
  '/settings': 'Settings',
}

const pageTitle = computed(() => {
  const path = route.path
  const calendarId = route.query.calendar
  if (calendarId && path === '/events') {
    const cal = calendars.value.find(c => c.id === calendarId)
    if (cal) return cal.name
  }
  const exact = pageTitles[path]
  if (exact) return exact
  const match = Object.entries(pageTitles).find(([k]) => path.startsWith(k + '/'))
  return match ? match[1] : 'FriendlyManager'
})

function isActive(href: string) {
  return route.path === href || route.path.startsWith(href + '/')
}
</script>
