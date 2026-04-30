<template>
  <div class="flex h-screen overflow-hidden" style="background:#F5F8FA">
    <!-- Narrow icon-only sidebar -->
    <aside
      class="w-14 shrink-0 flex flex-col items-center py-3 gap-1 relative z-[60]"
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
          class="absolute left-full top-0 z-[70]"
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
                  <span :class="cal.name ? '' : 'italic text-gray-400'">{{ cal.name || 'Untitled calendar' }}</span>
                </NuxtLink>
              </div>
            </template>

            <!-- Reporting -->
            <div class="border-t border-gray-100" />
            <NuxtLink
              to="/events/reporting"
              class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              @click="eventsHover = false"
            >
              <i class="pi pi-chart-bar text-gray-400 text-xs" />
              Reporting
            </NuxtLink>

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
      <template v-for="item in navItems" :key="item.href">
        <!-- Bookables: flyout with pinned venues -->
        <div v-if="item.href === '/bookables' && menuBookables.length"
          class="relative"
          @mouseenter="onBookablesEnter"
          @mouseleave="onBookablesLeave">
          <NuxtLink :to="item.href"
            class="relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
            :class="isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'">
            <i :class="`pi ${item.icon} text-lg`" />
            <span v-if="pendingBookingsCount > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-[#1E2157]"
              v-tooltip.right="`${pendingBookingsCount} booking${pendingBookingsCount === 1 ? '' : 's'} awaiting approval`">
              {{ pendingBookingsCount > 99 ? '99+' : pendingBookingsCount }}
            </span>
          </NuxtLink>
          <div v-show="bookablesHover"
            class="absolute left-full top-0 z-[70]" style="padding-left:10px"
            @mouseenter="onBookablesEnter" @mouseleave="onBookablesLeave">
            <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="width:220px">
              <NuxtLink to="/bookables"
                class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                @click="bookablesHover = false">
                <i class="pi pi-building text-gray-400 text-xs" /> View all Bookables
              </NuxtLink>
              <NuxtLink v-if="pendingBookingsCount > 0" to="/bookings/pending"
                class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-amber-700 bg-amber-50/50 hover:bg-amber-50 transition-colors border-t border-amber-100"
                @click="bookablesHover = false">
                <i class="pi pi-clock text-amber-500 text-xs" />
                <span class="flex-1">Review pending bookings</span>
                <span class="text-[10px] font-bold uppercase tracking-wide bg-amber-500 text-white px-1.5 py-0.5 rounded-full">{{ pendingBookingsCount }}</span>
              </NuxtLink>
              <div v-if="menuBookables.length" class="border-t border-gray-100" />
              <div v-if="menuBookables.length" class="py-1">
                <NuxtLink v-for="b in menuBookables" :key="b.id"
                  :to="`/bookables/${b.id}`"
                  class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  @click="bookablesHover = false">
                  <img v-if="b.sponsor_image || b.main_image" :src="b.sponsor_image || b.main_image"
                    class="w-5 h-5 rounded object-contain shrink-0" />
                  <i v-else class="pi pi-building text-gray-300 text-xs shrink-0" />
                  {{ b.name }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- All other nav items -->
        <NuxtLink v-else
          :to="item.href"
          class="group relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
          :class="isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'">
          <i :class="`pi ${item.icon} text-lg`" />
          <span v-if="item.href === '/bookables' && pendingBookingsCount > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-[#1E2157]">
            {{ pendingBookingsCount > 99 ? '99+' : pendingBookingsCount }}
          </span>
          <span class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow">
            {{ item.label }}
          </span>
        </NuxtLink>
      </template>

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

      <!-- Avatar with sign-out flyout -->
      <div class="relative mt-2" @mouseenter="avatarHover = true" @mouseleave="avatarHover = false">
        <div
          class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center cursor-pointer hover:bg-white/30 transition-colors"
          :title="user?.email"
        >
          <span v-if="userInitials" class="text-white text-xs font-semibold">{{ userInitials }}</span>
          <i v-else class="pi pi-user text-white text-sm" />
        </div>
        <div v-show="avatarHover" class="absolute left-full bottom-0 z-50" style="padding-left:10px">
          <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="width:180px">
            <div class="px-4 py-2.5 border-b border-gray-100">
              <p class="text-xs text-gray-400 truncate">{{ user?.email }}</p>
            </div>
            <button
              class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
              @click="handleLogout"
            >
              <i class="pi pi-sign-out text-xs" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Right panel: top bar + page content -->
    <div class="flex flex-col flex-1 min-w-0">
      <!-- Top header bar -->
      <header class="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-6 gap-4 z-10">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <nav v-if="breadcrumbs.length" class="flex items-center gap-1.5 text-sm min-w-0">
            <template v-for="(crumb, i) in breadcrumbs" :key="i">
              <i v-if="i > 0" class="pi pi-chevron-right text-[10px] text-gray-300 shrink-0" />
              <NuxtLink v-if="crumb.to" :to="crumb.to" class="text-gray-400 hover:text-gray-700 transition-colors shrink-0">{{ crumb.label }}</NuxtLink>
              <span v-else class="font-semibold text-gray-800 truncate">{{ crumb.label }}</span>
            </template>
          </nav>
          <h1 v-else class="text-base font-semibold text-gray-900">{{ pageTitle }}</h1>
        </div>
        <!-- Notifications bell -->
        <div ref="bellWrapper" class="relative">
          <button type="button"
            class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 relative"
            @click="onBellClick">
            <i class="pi pi-bell text-base" />
            <span v-if="unreadNotifications > 0"
              class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {{ unreadNotifications > 99 ? '99+' : unreadNotifications }}
            </span>
          </button>
          <!-- Dropdown panel -->
          <div v-if="bellOpen"
            class="absolute right-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p class="text-sm font-semibold text-gray-800">Notifications</p>
              <button v-if="unreadNotifications > 0" type="button"
                class="text-xs text-[#1E2157] hover:underline" @click="markAllRead">Mark all read</button>
            </div>
            <div v-if="!notifications.length" class="text-sm text-gray-400 italic py-6 text-center">
              You're all caught up.
            </div>
            <div v-else class="max-h-96 overflow-y-auto">
              <NuxtLink v-for="n in notifications" :key="n.id"
                :to="n.link || '#'"
                class="block px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors"
                :class="n.read_at ? '' : 'bg-blue-50/30'"
                @click="markRead(n)">
                <div class="flex items-start gap-2">
                  <i class="pi pi-bell text-xs mt-1"
                    :class="n.read_at ? 'text-gray-300' : 'text-[#1E2157]'" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">{{ n.title }}</p>
                    <p v-if="n.body" class="text-xs text-gray-500 truncate">{{ n.body }}</p>
                    <p class="text-[10px] text-gray-400 mt-0.5">{{ formatRelative(n.created_at) }}</p>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 bg-red-600 text-white text-xs font-semibold px-4 py-1.5 rounded-lg">
          <i class="pi pi-exclamation-triangle" />
          Early prototype — not production ready
        </div>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto">
        <slot v-if="orgReady" />
        <div v-else class="flex items-center justify-center h-full">
          <i class="pi pi-spin pi-spinner text-2xl text-surface-400" />
        </div>
      </main>
      <Toast />
    </div>
  </div>

  <!-- Prototype disclaimer modal -->
  <Dialog v-model:visible="showDisclaimer" modal :closable="false" :draggable="false"
    style="width: 480px"
    :pt="{ mask: { style: 'backdrop-filter: blur(20px); background: rgba(0,0,0,0.5)' }, header: { style: 'padding: 0' } }">
    <template #header>
      <div class="w-full bg-red-600 px-6 py-4 flex items-center gap-3 rounded-t-xl">
        <i class="pi pi-exclamation-triangle text-white text-lg" />
        <span class="text-base font-bold text-white">Early prototype</span>
      </div>
    </template>
    <div class="text-sm text-gray-600 py-4 px-2">
      <p class="mb-3 text-gray-700">Please be aware of the following before continuing:</p>
      <ul class="space-y-2.5">
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
          <span>This is an <strong class="text-gray-900">early-stage prototype</strong> — it is not production software and is subject to change without notice.</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
          <span>Features shown are <strong class="text-gray-900">incomplete</strong> and may contain bugs or missing functionality.</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
          <span>Do <strong class="text-gray-900">not</strong> enter sensitive or real customer data.</span>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></span>
          <span>This is for <strong class="text-gray-900">demonstration and feedback purposes only</strong>.</span>
        </li>
      </ul>
    </div>
    <template #footer>
      <Button label="I understand" icon="pi pi-check" class="w-full" @click="acknowledgeDisclaimer"
        style="background:#1E2157;border-color:#1E2157" />
    </template>
  </Dialog>

</template>

<script setup lang="ts">
const route = useRoute()
const db = useSupabaseClient()
const user = useSupabaseUser()
const breadcrumbs = useBreadcrumbs()
const { orgId, orgReady } = useOrg()

// ── Notifications bell ────────────────────────────────────
const notifications = ref<any[]>([])
const bellOpen = ref(false)
const unreadNotifications = computed(() => notifications.value.filter(n => !n.read_at).length)

// Count of bookings that need staff approval — surfaced as a badge on the
// Bookables sidebar icon so the workflow is visible without opening the bell.
const pendingBookingsCount = ref(0)
async function loadPendingBookingsCount() {
  if (!orgId.value) return
  // bookings has no org_id column — scope through the bookable's org.
  const { count } = await (db.from as any)('bookings')
    .select('id, bookable:bookables!inner(org_id)', { count: 'exact', head: true })
    .eq('bookable.org_id', orgId.value)
    .eq('status', 'PENDING')
  pendingBookingsCount.value = count ?? 0
}

async function loadNotifications() {
  if (!orgId.value) return
  const { data } = await (db.from as any)('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('org_id', orgId.value)
    .order('created_at', { ascending: false })
    .limit(20)
  notifications.value = data ?? []
  // Pending count tracks closely with notification activity — re-pull it here.
  loadPendingBookingsCount()
}
function onBellClick() {
  bellOpen.value = !bellOpen.value
  if (bellOpen.value) loadNotifications()
}
async function markRead(n: any) {
  if (n.read_at) return
  n.read_at = new Date().toISOString()
  await (db.from as any)('notifications').update({ read_at: n.read_at }).eq('id', n.id)
}
async function markAllRead() {
  const ids = notifications.value.filter(n => !n.read_at).map(n => n.id)
  if (!ids.length) return
  const stamp = new Date().toISOString()
  for (const n of notifications.value) if (!n.read_at) n.read_at = stamp
  await (db.from as any)('notifications').update({ read_at: stamp }).in('id', ids)
}
function formatRelative(iso: string): string {
  const d = new Date(iso)
  const ms = Date.now() - d.getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
// Initial unread count + close-on-outside-click
watch(orgId, (v) => { if (v) { loadNotifications(); loadPendingBookingsCount() } }, { immediate: true })
const bellWrapper = ref<HTMLElement | null>(null)
let pollHandle: any = null
onMounted(() => {
  document.addEventListener('click', onDocClick)
  pollHandle = setInterval(() => { if (orgId.value) loadNotifications() }, 30_000)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (pollHandle) clearInterval(pollHandle)
})
function onDocClick(e: MouseEvent) {
  if (!bellOpen.value) return
  if (bellWrapper.value && !bellWrapper.value.contains(e.target as Node)) bellOpen.value = false
}

const orgName = ref('FriendlyManager')
const userInitials = computed(() => {
  const email = user.value?.email ?? ''
  return email ? email[0].toUpperCase() : ''
})

async function loadOrgName() {
  // orgs table not yet created — skip gracefully
}

async function handleLogout() {
  await db.auth.signOut()
  sessionStorage.removeItem('prototype_acknowledged')
  navigateTo('/login')
}

const showDisclaimer = ref(false)

function acknowledgeDisclaimer() {
  sessionStorage.setItem('prototype_acknowledged', '1')
  showDisclaimer.value = false
}

onMounted(() => {
  if (!sessionStorage.getItem('prototype_acknowledged')) {
    showDisclaimer.value = true
  }
})

watch(orgId, loadOrgName, { immediate: true })

// ---- Bookables menu ----
const { items: menuBookables, reload: loadMenuBookables } = useMenuBookables()

const avatarHover = ref(false)
const bookablesHover = ref(false)
let bookablesLeaveTimer: ReturnType<typeof setTimeout> | null = null

function onBookablesEnter() {
  if (bookablesLeaveTimer) { clearTimeout(bookablesLeaveTimer); bookablesLeaveTimer = null }
  bookablesHover.value = true
}
function onBookablesLeave() {
  bookablesLeaveTimer = setTimeout(() => { bookablesHover.value = false }, 180)
}

// ---- Calendars ----
const calendars = ref<{ id: string; name: string; color: string | null }[]>([])

async function loadCalendars() {
  const { data } = await (db.from as any)('calendars').select('id, name').order('sort_order')
  calendars.value = (data ?? []).map((c: any) => ({ id: c.id, name: c.name, color: null }))
}

onMounted(() => { loadCalendars(); loadMenuBookables() })
watch(() => route.path, loadMenuBookables)

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
  { href: '/bookables', label: 'Bookables', icon: 'pi-building' },
  { href: '/registration', label: 'Registration', icon: 'pi-clipboard' },
  { href: '/finances', label: 'Finances', icon: 'pi-dollar' },
  { href: '/reporting', label: 'Reporting', icon: 'pi-chart-bar' },
]

const pageTitles: Record<string, string> = {
  '/events': 'Events',
  '/bookables': 'Bookables',
  '/finances': 'Finances',
  '/registration': 'Registration',
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
