<template>
  <div class="flex h-screen overflow-hidden" style="background:#F5F8FA">
    <!-- Icon-rail sidebar (desktop only — mobile uses the bottom tab bar) -->
    <aside class="w-14 shrink-0 hidden md:flex flex-col items-center py-3 gap-1 relative z-[60]"
      style="background: linear-gradient(180deg, var(--brand-primary) 0%, #21278E 100%)">
      <NuxtLink to="/dashboard" class="mb-3 w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden" :title="activeOrgName">
        <img v-if="brandMark" :src="brandMark" class="w-full h-full object-cover" />
        <i v-else class="pi pi-calendar text-white text-sm" />
      </NuxtLink>

      <template v-for="item in clubMenu" :key="item.label">
        <!-- Events: icon + rich flyout (calendars, reporting, venues, registration, forms) -->
        <div v-if="item.events" class="relative" @mouseenter="onEventsEnter" @mouseleave="onEventsLeave">
          <NuxtLink :to="item.href"
            class="flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
            :class="isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'">
            <i :class="['pi', item.icon, 'text-lg']" />
          </NuxtLink>
          <div v-show="eventsHover" class="absolute left-full top-0 z-[70]" style="padding-left:10px"
            @mouseenter="onEventsEnter" @mouseleave="onEventsLeave">
            <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="width:220px">
              <NuxtLink to="/events" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="eventsHover = false"><i class="pi pi-calendar text-gray-400 text-xs" />View Events</NuxtLink>
              <template v-if="calendars.length"><div class="border-t border-gray-100" /><div class="py-1">
                <NuxtLink v-for="cal in calendars" :key="cal.id" :to="`/events?calendar=${cal.id}`" class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50" @click="eventsHover = false">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: cal.color ?? '#94a3b8' }" />
                  <span :class="cal.name ? '' : 'italic text-gray-400'">{{ cal.name || 'Untitled calendar' }}</span>
                </NuxtLink></div></template>
              <div class="border-t border-gray-100" />
              <NuxtLink to="/events/reporting" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="eventsHover = false"><i class="pi pi-chart-bar text-gray-400 text-xs" />Reporting</NuxtLink>
              <NuxtLink to="/bookables" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="eventsHover = false"><i class="pi pi-building text-gray-400 text-xs" /><span class="flex-1">Venues &amp; Bookings</span><span v-if="pendingBookingsCount > 0" class="text-[10px] font-bold bg-amber-500 text-white px-1.5 rounded-full">{{ pendingBookingsCount }}</span></NuxtLink>
              <NuxtLink to="/registration" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="eventsHover = false"><i class="pi pi-clipboard text-gray-400 text-xs" />Registration</NuxtLink>
              <NuxtLink to="/forms" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="eventsHover = false"><i class="pi pi-file-edit text-gray-400 text-xs" />Forms</NuxtLink>
              <div class="border-t border-gray-100" />
              <button class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="openNewCalendarModal"><i class="pi pi-plus text-gray-400 text-xs" />New Category</button>
            </div>
          </div>
        </div>

        <!-- Other items: icon + hover tooltip -->
        <NuxtLink v-else :to="item.href"
          class="group relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors"
          :class="isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white'">
          <i :class="['pi', item.icon, 'text-lg']" />
          <span class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow">{{ item.label }}</span>
        </NuxtLink>
      </template>

    </aside>

    <!-- Right panel: top bar + page content. Pushes left when the review
         drawer slides out on the right (desktop only; it overlays on mobile). -->
    <div class="flex flex-col flex-1 min-w-0 transition-[margin] duration-300 ease-out"
      :class="reviewPanel ? 'md:mr-[440px]' : ''">
      <!-- Top header bar -->
      <header class="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-3 sm:px-6 gap-2 sm:gap-4 z-10">
        <!-- Mobile brand mark (icon rail is hidden on mobile) — tap to go home -->
        <NuxtLink to="/dashboard" class="md:hidden w-8 h-8 shrink-0 rounded-lg flex items-center justify-center overflow-hidden" style="background: var(--brand-primary)" :title="activeOrgName">
          <img v-if="brandMark" :src="brandMark" class="w-full h-full object-cover" />
          <i v-else class="pi pi-calendar text-white text-sm" />
        </NuxtLink>
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <nav v-if="breadcrumbs.length" class="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
            <template v-for="(crumb, i) in breadcrumbs" :key="i">
              <i v-if="i > 0" class="pi pi-chevron-right text-[10px] text-gray-300 shrink-0" />
              <NuxtLink v-if="crumb.to" :to="crumb.to" class="text-gray-400 hover:text-gray-700 transition-colors shrink-0">{{ crumb.label }}</NuxtLink>
              <span v-else class="font-semibold text-gray-800 truncate">{{ crumb.label }}</span>
            </template>
          </nav>
          <h1 v-else class="hidden sm:block text-base font-semibold text-gray-900 truncate">{{ pageTitle }}</h1>
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
                class="text-xs text-primary hover:underline" @click="markAllRead">Mark all read</button>
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
                    :class="n.read_at ? 'text-gray-300' : 'text-primary'" />
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

        <ReviewWidget v-if="orgReady && user && !gate.isDeveloper.value" hide-pill />

        <!-- Comments & review — pops out the <ReviewWidget> drawer -->
        <button v-if="orgReady && user && !gate.isDeveloper.value" type="button"
          class="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          :class="reviewCount > 0 ? 'text-primary' : 'text-gray-500'"
          v-tooltip.bottom="reviewCount > 0 ? `${reviewCount} open comment${reviewCount === 1 ? '' : 's'}` : 'Comments & review'"
          @click="reviewPanel = true">
          <i :class="reviewCount > 0 ? 'pi pi-comments' : 'pi pi-comment'" class="text-base" />
          <span v-if="reviewCount > 0"
            class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {{ reviewCount > 99 ? '99+' : reviewCount }}
          </span>
        </button>

        <!-- Settings gear -->
        <NuxtLink to="/settings"
          class="hidden md:flex w-9 h-9 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 shrink-0"
          title="Settings">
          <i class="pi pi-cog text-base" />
        </NuxtLink>

        <!-- User avatar + dropdown -->
        <div ref="userMenuWrapper" class="relative shrink-0">
          <button type="button" class="flex items-center gap-1.5 rounded-full p-0.5 hover:bg-gray-100 transition-colors"
            @click="userMenuOpen = !userMenuOpen">
            <span class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-sm font-semibold flex items-center justify-center"
              :class="userMenuOpen ? 'ring-2 ring-primary ring-offset-1' : ''">{{ userInitials }}</span>
            <i class="pi pi-chevron-down text-[10px] text-gray-400 hidden sm:inline" />
          </button>
          <div v-if="userMenuOpen"
            class="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
            <div class="px-4 py-3 border-b border-gray-100">
              <p class="text-sm font-semibold text-gray-900 truncate">{{ userName }}</p>
              <p class="text-xs text-gray-400 truncate">{{ user?.email }}</p>
            </div>
            <OrgSwitcher @switched="userMenuOpen = false" />
            <NuxtLink v-if="isSuper" to="/admin" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              @click="userMenuOpen = false"><i class="pi pi-sitemap text-gray-400 w-4 text-center" />All orgs</NuxtLink>
            <NuxtLink to="/settings" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              @click="userMenuOpen = false"><i class="pi pi-cog text-gray-400 w-4 text-center" />Settings</NuxtLink>
            <button type="button" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left"
              @click="handleLogout"><i class="pi pi-sign-out text-gray-400 w-4 text-center" />Sign out</button>
          </div>
        </div>

        <!-- Help -->
        <button type="button"
          class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 shrink-0"
          v-tooltip.bottom="'Help & about'" @click="showDisclaimer = true">
          <i class="pi pi-question-circle text-base" />
        </button>
      </header>

      <!-- Page content -->
      <main class="flex-1 overflow-y-auto relative pb-16 md:pb-0">
        <template v-if="orgReady">
          <!-- Developer gate: only approved pages are visible to users with role='developer' -->
          <div v-if="gate.blocked.value" class="min-h-full flex flex-col items-center justify-center px-6 py-12 bg-[#F5F8FA]">
            <div class="max-w-md w-full bg-white border border-gray-200 rounded-xl shadow-sm p-6 text-center">
              <div class="w-12 h-12 mx-auto rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                <i class="pi pi-lock text-amber-600 text-lg" />
              </div>
              <h2 class="text-base font-bold text-gray-900">Not yet approved</h2>
              <p class="text-sm text-gray-500 mt-1">
                This page hasn't been signed off for development yet.
              </p>
              <p class="text-[11px] font-mono text-gray-400 mt-3 truncate">{{ gate.pageKey.value }}</p>
              <div v-if="gate.approvedNavigable.value.length" class="mt-5 text-left">
                <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Approved pages</p>
                <div class="flex flex-col gap-1">
                  <NuxtLink v-for="row in gate.approvedNavigable.value"
                    :key="row.path + (row.tab ?? '')"
                    :to="row.tab ? { path: row.path, query: { tab: row.tab } } : row.path"
                    class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-100">
                    <i class="pi pi-check-circle text-emerald-500 text-xs shrink-0" />
                    <span class="font-mono text-[11px] truncate">{{ row.path }}{{ row.tab ? '?tab=' + row.tab : '' }}</span>
                  </NuxtLink>
                </div>
              </div>
              <p v-else class="text-[11px] text-gray-400 mt-5">
                No pages have been approved yet.
              </p>
            </div>
          </div>
          <slot v-else />
        </template>
        <div v-else class="flex items-center justify-center h-full">
          <i class="pi pi-spin pi-spinner text-2xl text-surface-400" />
        </div>
      </main>
      <Toast />
    </div>

    <!-- Mobile bottom tab bar -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 z-[55] bg-white border-t border-gray-200 flex items-stretch h-16"
      style="padding-bottom: env(safe-area-inset-bottom)">
      <NuxtLink v-for="item in mobilePrimary" :key="item.href" :to="item.href"
        class="flex-1 flex flex-col items-center justify-center gap-0.5"
        :class="isActive(item.href) ? 'text-primary' : 'text-gray-400'">
        <i :class="['pi', item.icon, 'text-lg']" />
        <span class="text-[10px] font-medium">{{ item.label }}</span>
      </NuxtLink>
      <button type="button" class="flex-1 flex flex-col items-center justify-center gap-0.5 text-gray-400"
        :class="mobileMenuOpen ? 'text-primary' : ''" @click="mobileMenuOpen = true">
        <i class="pi pi-bars text-lg" />
        <span class="text-[10px] font-medium">More</span>
      </button>
    </nav>

    <!-- Mobile "More" sheet: full menu + profile -->
    <div v-if="mobileMenuOpen" class="md:hidden fixed inset-0 z-[70]">
      <div class="absolute inset-0 bg-black/40" @click="mobileMenuOpen = false" />
      <div class="absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-2xl flex flex-col overflow-hidden">
        <div class="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <span class="font-semibold text-gray-900">Menu</span>
          <button class="text-gray-400 hover:text-gray-700" @click="mobileMenuOpen = false"><i class="pi pi-times" /></button>
        </div>
        <div class="overflow-y-auto p-2">
          <NuxtLink v-for="item in clubMenu" :key="item.label" :to="item.href"
            class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium"
            :class="isActive(item.href) ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50'">
            <i :class="['pi', item.icon, 'text-base w-5 text-center']" />{{ item.label }}
          </NuxtLink>
          <div class="border-t border-gray-100 my-2" />
          <button v-if="orgReady && user && !gate.isDeveloper.value" type="button" class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 text-left" @click="openReviewFromMobile"><i class="pi pi-comment text-base w-5 text-center" />Comments &amp; review<span v-if="reviewCount > 0" class="ml-auto min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">{{ reviewCount > 99 ? '99+' : reviewCount }}</span></button>
          <NuxtLink to="/settings" class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"><i class="pi pi-cog text-base w-5 text-center" />Settings</NuxtLink>
          <NuxtLink to="/switch-role" class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"><i class="pi pi-sync text-base w-5 text-center" />Switch role</NuxtLink>
          <button type="button" class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 text-left" @click="handleLogout"><i class="pi pi-sign-out text-base w-5 text-center" />Sign out</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Prototype disclaimer modal -->
  <Dialog v-model:visible="showDisclaimer" modal :closable="false" :draggable="false"
    :style="{ width: '95vw', maxWidth: '480px' }"
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
        style="background:var(--brand-primary);border-color:var(--brand-primary)" />
    </template>
  </Dialog>

</template>

<script setup lang="ts">
const route = useRoute()
const db = useSupabaseClient()
const user = useSupabaseUser()
const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')
const breadcrumbs = useBreadcrumbs()
const { orgId, orgReady } = useOrg()
const gate = useDeveloperGate()
useBrandTheme() // re-themes --brand-primary from the active org's connected brand
// Pull the list of approved-and-navigable pages once for the gate stub,
// then refresh whenever the developer lands on a still-blocked page.
watch([gate.isDeveloper, gate.pageKey], () => {
  if (gate.isDeveloper.value) gate.loadApprovedNavigable()
}, { immediate: true })

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
// Refresh the pending-bookings badge on every navigation so it reflects
// recent approve/decline/reset actions without waiting on the 30s poll.
watch(() => route.path, () => { if (orgId.value) loadPendingBookingsCount() })
const bellWrapper = ref<HTMLElement | null>(null)
let pollHandle: any = null
onMounted(() => {
  document.addEventListener('click', onDocClick)
  pollHandle = setInterval(() => { if (orgId.value) { loadNotifications(); loadPendingBookingsCount() } }, 30_000)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (pollHandle) clearInterval(pollHandle)
})
function onDocClick(e: MouseEvent) {
  if (bellOpen.value && bellWrapper.value && !bellWrapper.value.contains(e.target as Node)) bellOpen.value = false
  if (userMenuOpen.value && userMenuWrapper.value && !userMenuWrapper.value.contains(e.target as Node)) userMenuOpen.value = false
}

const reviewPanel = useReviewPanel()
const reviewCount = useReviewCount()
function openReviewFromMobile() { mobileMenuOpen.value = false; reviewPanel.value = true }
const userMenuOpen = ref(false)
const userMenuWrapper = ref<HTMLElement | null>(null)
const userName = computed(() => {
  const m = (user.value?.user_metadata as any) || {}
  return m.full_name || m.name || (user.value?.email ? user.value.email.split('@')[0] : 'Account')
})

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
  if (!orgId.value) { calendars.value = []; return }
  // Scope to the active org — otherwise the menu pools every org's calendars.
  const { data } = await (db.from as any)('calendars').select('id, name').eq('org_id', orgId.value).order('sort_order')
  calendars.value = (data ?? []).map((c: any) => ({ id: c.id, name: c.name, color: null }))
}

onMounted(() => { loadMenuBookables() })
// Reload calendars whenever the active org changes (incl. super-admin switch).
watch(orgId, loadCalendars, { immediate: true })
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
  { href: '/bookables', label: 'Bookables', icon: 'pi-building', resource: 'bookings' },
  { href: '/bookables?tab=bookings', label: 'Bookings', icon: 'pi-calendar', resource: 'bookings' },
  { href: '/registration', label: 'Registration', icon: 'pi-clipboard', resource: 'events' },
  { href: '/attendance', label: 'Attendance', icon: 'pi-check-square', resource: 'attendance' },
  { href: '/groups', label: 'Groups', icon: 'pi-users', resource: 'groups' },
  { href: '/finances', label: 'Finances', icon: 'pi-dollar', resource: 'fees' },
  { href: '/reporting', label: 'Reporting', icon: 'pi-chart-bar' },
  { href: '/proto', label: 'Prototype', icon: 'pi-compass' },
  { href: '/settings/communications', label: 'Communications', icon: 'pi-megaphone', resource: 'settings' },
  // Permissions, Fields and Terminology now live under Settings (via <SettingsNav>).
]

// ---- Club menu (wide labelled left nav, mirrors the legacy club menu order/icons) ----
// `events: true` gets the rich expandable sub-list (calendars, reporting, venues, etc.).
// Items without a built page point at a ComingSoon placeholder route.
const clubMenu = [
  { label: 'Dashboard',   icon: 'pi-th-large',      href: '/dashboard',               chevron: false },
  { label: 'People',      icon: 'pi-users',         href: '/people',                  chevron: true },
  { label: 'Classes',     icon: 'pi-sitemap',       href: '/groups',                  chevron: true },
  { label: 'Fees',        icon: 'pi-dollar',        href: '/finances',                chevron: true },
  { label: 'Events',      icon: 'pi-calendar',      href: '/events',                  chevron: true, events: true },
  { label: 'Bookings',    icon: 'pi-bookmark',      href: '/bookables?tab=bookings',  chevron: true },
  { label: 'Attendance',  icon: 'pi-check-square',  href: '/attendance',              chevron: true },
  { label: 'Mailer',      icon: 'pi-envelope',      href: '/settings/communications', chevron: true },
  { label: 'Resources',   icon: 'pi-video',         href: '/resources',               chevron: false },
  { label: 'Assets',      icon: 'pi-shopping-cart', href: '/assets',                  chevron: true },
  { label: 'Mobile App',  icon: 'pi-mobile',        href: '/mobile-app',              chevron: true },
  { label: 'Programme',   icon: 'pi-flag',          href: '/programme',               chevron: true },
  { label: 'GNZ',         icon: 'pi-user',          href: '/gnz',                     chevron: true },
  { label: 'FM Invoices', icon: 'pi-file',          href: '/fm-invoices',             chevron: false },
]
// Which top-level item is expanded (one at a time).
const expandedMenu = ref<string | null>(null)
function toggleMenu(label: string) { expandedMenu.value = expandedMenu.value === label ? null : label }

// ── Mobile navigation (bottom tab bar + "More" sheet) ──
const mobilePrimary = [
  { label: 'People', icon: 'pi-users',        href: '/people' },
  { label: 'Events', icon: 'pi-calendar',     href: '/events' },
  { label: 'Fees',   icon: 'pi-dollar',       href: '/finances' },
]
const mobileMenuOpen = ref(false)
watch(() => route.path, () => { mobileMenuOpen.value = false })

// Permission enforcement + governing-body extras.
const { can, load: loadPerms } = useCan()
const isGoverningOrg = ref(false)
const activeOrgName = ref('')
// Brand mark shown top-left: the org's own icon, else its connected brand's icon.
const brandMark = ref<string | null>(null)
watch(orgId, async (id) => {
  loadPerms()
  if (!id) { isGoverningOrg.value = false; activeOrgName.value = ''; brandMark.value = null; return }
  const { data } = await (db.from as any)('organisations').select('name, org_level, icon_url, brand_id').eq('id', id).single()
  isGoverningOrg.value = !!data?.org_level && data.org_level !== 'CLUB'
  activeOrgName.value = data?.name ?? ''
  if (data?.icon_url) {
    brandMark.value = data.icon_url
  } else if (data?.brand_id) {
    const { data: brand } = await (db.from as any)('brands').select('icon_url').eq('id', data.brand_id).maybeSingle()
    brandMark.value = brand?.icon_url ?? null
  } else {
    brandMark.value = null
  }
}, { immediate: true })
const navItemsForOrg = computed(() => {
  const base = isGoverningOrg.value
    ? [...navItems, { href: '/disciplines', label: 'Disciplines', icon: 'pi-tags' }]
    : navItems
  // Hide modules the user has no read permission for (unrestricted users see all).
  return base.filter((i: any) => !i.resource || can(i.resource, 'read'))
})

const pageTitles: Record<string, string> = {
  '/events': 'Events',
  '/bookables': 'Bookables',
  '/finances': 'Finances',
  '/registration': 'Registration',
  '/attendance': 'Attendance',
  '/groups': 'Groups',
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

// Browser tab title: "Club name: Page" — so multiple club tabs are distinguishable.
useHead({
  title: () => activeOrgName.value ? `${activeOrgName.value}: ${pageTitle.value}` : pageTitle.value,
  titleTemplate: '%s',
})

function isActive(href: string) {
  return route.path === href || route.path.startsWith(href + '/')
}
</script>
