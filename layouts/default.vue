<template>
  <div class="flex h-screen overflow-hidden" style="background:#F5F8FA">
    <!-- Icon-rail sidebar (desktop only — mobile uses the bottom tab bar) -->
    <aside class="shrink-0 hidden md:flex flex-col py-3 gap-1 relative z-[60] transition-[width] duration-200"
      :class="railExpanded ? 'w-56 items-stretch px-2' : 'w-14 items-center'"
      style="background: linear-gradient(180deg, var(--brand-primary) 0%, var(--brand-primary-dark, #21278E) 100%)">
      <button type="button" @click="toggleRail"
        v-tooltip.right="railExpanded ? '' : 'Expand menu'"
        class="mb-3 flex items-center rounded-lg text-white hover:bg-white/10 transition-colors"
        :class="railExpanded ? 'w-full h-10 px-1.5 gap-2.5 justify-start' : 'w-10 h-10 justify-center'">
        <span class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
          <img v-if="brandMark" :src="brandMark" class="w-full h-full object-cover" />
          <i v-else class="pi pi-calendar text-white text-sm" />
        </span>
        <span v-if="railExpanded" class="flex-1 text-sm font-semibold truncate text-left">{{ activeOrgName || 'FriendlyManager' }}</span>
        <i v-if="railExpanded" class="pi pi-angle-left text-white/60 text-xs shrink-0" />
      </button>

      <template v-for="item in clubMenuForModules" :key="item.label">
        <!-- Events: icon + rich flyout (calendars, reporting, venues, registration, forms) -->
        <div v-if="item.events" class="relative" @mouseenter="onEventsEnter" @mouseleave="onEventsLeave">
          <NuxtLink :to="item.href"
            class="flex items-center rounded-xl transition-colors"
            :class="[railBtnClass, isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white']">
            <i :class="['pi', item.icon, 'text-lg']" />
            <span v-if="railExpanded" class="flex-1 text-sm whitespace-nowrap text-left">{{ item.label }}</span>
            <i v-if="railExpanded" class="pi pi-angle-right text-white/40 text-xs shrink-0" />
          </NuxtLink>
          <div v-show="eventsHover" class="absolute left-full top-0 z-[70]" style="padding-left:10px"
            @mouseenter="onEventsEnter" @mouseleave="onEventsLeave">
            <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="width:220px">
              <NuxtLink v-if="menuSubVisible('/events')" to="/events" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="eventsHover = false"><i class="pi pi-calendar text-gray-400 text-xs" />View Events</NuxtLink>
              <template v-if="calendars.length"><div class="border-t border-gray-100" /><div class="py-1">
                <NuxtLink v-for="cal in calendars" :key="cal.id" :to="`/events?calendar=${cal.id}`" class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50" @click="eventsHover = false">
                  <i :class="[calIconClass(cal.icon), 'text-xs shrink-0 w-3.5 text-center']" :style="{ color: cal.color ?? '#94a3b8' }" />
                  <span :class="cal.name ? '' : 'italic text-gray-400'">{{ cal.name || 'Untitled calendar' }}</span>
                </NuxtLink></div></template>
              <div class="border-t border-gray-100" />
              <button class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="openNewCalendarModal"><i class="pi pi-plus text-gray-400 text-xs" />New calendar</button>
            </div>
          </div>
        </div>

        <!-- Fees: icon + flyout (Finances, Group Fees) -->
        <div v-else-if="item.fees" class="relative" @mouseenter="onFeesEnter" @mouseleave="onFeesLeave">
          <NuxtLink :to="item.href"
            class="flex items-center rounded-xl transition-colors"
            :class="[railBtnClass, isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white']">
            <i :class="['pi', item.icon, 'text-lg']" />
            <span v-if="railExpanded" class="flex-1 text-sm whitespace-nowrap text-left">{{ item.label }}</span>
            <i v-if="railExpanded" class="pi pi-angle-right text-white/40 text-xs shrink-0" />
          </NuxtLink>
          <div v-show="feesHover" class="absolute left-full top-0 z-[70]" style="padding-left:10px"
            @mouseenter="onFeesEnter" @mouseleave="onFeesLeave">
            <div class="w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1 overflow-hidden">
              <NuxtLink v-if="menuSubVisible('/finances')" to="/finances" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="feesHover = false"><i class="pi pi-dollar text-gray-400 text-xs" />Finances</NuxtLink>
              <NuxtLink v-if="menuSubVisible('/groups/fees')" to="/groups/fees" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="feesHover = false"><i class="pi pi-sitemap text-gray-400 text-xs" />Group fees</NuxtLink>
            </div>
          </div>
        </div>

        <!-- Bookings: icon + flyout (Bookings, Venues, Persons, Items) -->
        <div v-else-if="item.bookings" class="relative" @mouseenter="onBookingsEnter" @mouseleave="onBookingsLeave">
          <NuxtLink :to="item.href"
            class="flex items-center rounded-xl transition-colors"
            :class="[railBtnClass, isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white']">
            <i :class="['pi', item.icon, 'text-lg']" />
            <span v-if="railExpanded" class="flex-1 text-sm whitespace-nowrap text-left">{{ item.label }}</span>
            <i v-if="railExpanded" class="pi pi-angle-right text-white/40 text-xs shrink-0" />
          </NuxtLink>
          <div v-show="bookingsHover" class="absolute left-full top-0 z-[70]" style="padding-left:10px"
            @mouseenter="onBookingsEnter" @mouseleave="onBookingsLeave">
            <div class="w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1 overflow-hidden">
              <NuxtLink v-if="menuSubVisible('/bookables?tab=bookings')" to="/bookables?tab=bookings" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="bookingsHover = false"><i class="pi pi-bookmark text-gray-400 text-xs" /><span class="flex-1">Bookings</span><span v-if="pendingBookingsCount > 0" class="text-[10px] font-bold bg-amber-500 text-white px-1.5 rounded-full">{{ pendingBookingsCount }}</span></NuxtLink>
              <div class="border-t border-gray-100" />
              <NuxtLink v-if="menuSubVisible('/bookables/venues')" to="/bookables/venues" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="bookingsHover = false"><i class="pi pi-building text-gray-400 text-xs" />Venues</NuxtLink>
              <NuxtLink v-if="menuSubVisible('/bookables/persons')" to="/bookables/persons" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="bookingsHover = false"><i class="pi pi-user text-gray-400 text-xs" />Persons</NuxtLink>
              <NuxtLink v-if="menuSubVisible('/bookables/items')" to="/bookables/items" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="bookingsHover = false"><i class="pi pi-box text-gray-400 text-xs" />Items</NuxtLink>
              <div class="border-t border-gray-100" />
              <NuxtLink v-if="menuSubVisible('/bookables?tab=activities')" to="/bookables?tab=activities" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="bookingsHover = false"><i class="pi pi-flag text-gray-400 text-xs" />Activities</NuxtLink>
            </div>
          </div>
        </div>

        <!-- Groups: icon + flyout (Groups, Classes, saved views, manage) -->
        <div v-else-if="item.groups" class="relative" @mouseenter="onGroupsEnter" @mouseleave="onGroupsLeave">
          <NuxtLink :to="item.href"
            class="flex items-center rounded-xl transition-colors"
            :class="[railBtnClass, isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white']">
            <i :class="['pi', item.icon, 'text-lg']" />
            <span v-if="railExpanded" class="flex-1 text-sm whitespace-nowrap text-left">{{ item.label }}</span>
            <i v-if="railExpanded" class="pi pi-angle-right text-white/40 text-xs shrink-0" />
          </NuxtLink>
          <div v-show="groupsHover" class="absolute left-full top-0 z-[70]" style="padding-left:10px"
            @mouseenter="onGroupsEnter" @mouseleave="onGroupsLeave">
            <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden" style="width:220px">
              <template v-if="groupViews.length"><div class="py-1">
                <NuxtLink v-for="v in groupViews" :key="v.id" :to="`/groups/view/${v.id}`" class="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" @click="groupsHover = false">
                  <i class="pi pi-th-large text-gray-300 text-xs" /><span class="truncate">{{ v.name }}</span>
                </NuxtLink></div><div class="border-t border-gray-100" /></template>
              <NuxtLink to="/groups" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="groupsHover = false"><i class="pi pi-table text-gray-400 text-xs" />Classes</NuxtLink>
              <NuxtLink to="/groups/timetable" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="groupsHover = false"><i class="pi pi-calendar text-gray-400 text-xs" />Week view</NuxtLink>
              <NuxtLink to="/groups/allocator" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="groupsHover = false"><i class="pi pi-arrows-h text-gray-400 text-xs" />Allocate</NuxtLink>
              <NuxtLink to="/groups/waitlists" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="groupsHover = false"><i class="pi pi-hourglass text-gray-400 text-xs" />Waitlists</NuxtLink>
              <NuxtLink to="/settings/terms" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="groupsHover = false"><i class="pi pi-clock text-gray-400 text-xs" />Terms</NuxtLink>
              <div class="border-t border-gray-100" />
              <NuxtLink to="/groups/settings" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="groupsHover = false"><i class="pi pi-cog text-gray-400 text-xs" />Settings</NuxtLink>
            </div>
          </div>
        </div>

        <!-- People: icon + flyout (People / Admins / Organisations) -->
        <div v-else-if="item.people" class="relative" :class="railExpanded ? 'w-full' : ''" @mouseenter="onPeopleEnter" @mouseleave="onPeopleLeave">
          <NuxtLink :to="item.href"
            class="flex items-center rounded-xl transition-colors"
            :class="[railBtnClass, isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white']">
            <i :class="['pi', item.icon, 'text-lg']" />
            <span v-if="railExpanded" class="flex-1 text-sm whitespace-nowrap text-left">{{ item.label }}</span>
            <i v-if="railExpanded" class="pi pi-angle-right text-white/40 text-xs shrink-0" />
          </NuxtLink>
          <div v-show="peopleHover" class="absolute left-full top-0 z-[70]" style="padding-left:10px"
            @mouseenter="onPeopleEnter" @mouseleave="onPeopleLeave">
            <div class="w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1 overflow-hidden">
              <NuxtLink v-if="menuSubVisible('/people?view=people')" to="/people?view=people" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="peopleHover = false"><i class="pi pi-users text-gray-400 text-xs" />People</NuxtLink>
              <NuxtLink v-if="menuSubVisible('/people?view=admins')" to="/people?view=admins" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="peopleHover = false"><i class="pi pi-shield text-gray-400 text-xs" />Admins</NuxtLink>
              <NuxtLink v-if="menuSubVisible('/people?view=organisations')" to="/people?view=organisations" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50" @click="peopleHover = false"><i class="pi pi-building text-gray-400 text-xs" />Organisations</NuxtLink>
            </div>
          </div>
        </div>

        <!-- Other items: icon + inline label (expanded) or hover tooltip (collapsed) -->
        <NuxtLink v-else :to="item.href"
          class="group relative flex items-center rounded-xl transition-colors"
          :class="[railBtnClass, isActive(item.href) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white']">
          <i :class="['pi', item.icon, 'text-lg']" />
          <span v-if="railExpanded" class="flex-1 text-sm whitespace-nowrap text-left">{{ item.label }}</span>
          <span v-else class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow">{{ item.label }}</span>
        </NuxtLink>
      </template>

      <!-- Pinned calendars — event calendars a club has promoted to the main menu -->
      <template v-if="eventsModuleOn">
        <NuxtLink v-for="cal in pinnedCalendars" :key="cal.id" :to="`/events?calendar=${cal.id}`"
          class="group relative flex items-center rounded-xl transition-colors"
          :class="[railBtnClass, isCalActive(cal.id) ? 'bg-white/20 text-white' : 'text-white/50 hover:bg-white/10 hover:text-white']">
          <!-- Rail icons NEVER take the item's own colour — they inherit the menu
               colour (white/50 → white) like every other rail item. A calendar's
               colour only shows in the Events flyout / dropdowns. Global rule. -->
          <i :class="[calIconClass(cal.icon), 'text-lg']" />
          <span v-if="railExpanded" class="flex-1 text-sm whitespace-nowrap text-left">{{ cal.name }}</span>
          <span v-else class="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow">{{ cal.name }}</span>
        </NuxtLink>
      </template>

    </aside>

    <!-- Right panel: top bar + page content. Pushes left when the review
         drawer slides out on the right (desktop only; it overlays on mobile). -->
    <div class="flex flex-col flex-1 min-w-0 transition-[margin] duration-300 ease-out"
      :class="(reviewPanel || notesPanel) ? 'md:mr-[440px]' : ''">
      <!-- Top header bar -->
      <header class="h-14 shrink-0 bg-white border-b border-gray-200 flex items-center px-3 sm:px-6 gap-2 sm:gap-4 z-30 relative">
        <!-- Mobile brand mark (icon rail is hidden on mobile) — tap to go home -->
        <NuxtLink to="/dashboard" class="md:hidden w-8 h-8 shrink-0 rounded-lg flex items-center justify-center overflow-hidden" style="background: var(--brand-primary)" :title="activeOrgName">
          <img v-if="brandMark" :src="brandMark" class="w-full h-full object-cover" />
          <i v-else class="pi pi-calendar text-white text-sm" />
        </NuxtLink>
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <!-- The control bar OWNS the page title. Visible on mobile too (only the
               current/last crumb shows on mobile; parent links collapse) so pages
               never need to repeat their own name as an in-page <h1>. -->
          <nav v-if="breadcrumbs.length" class="flex items-center gap-1.5 text-sm min-w-0">
            <template v-for="(crumb, i) in breadcrumbs" :key="i">
              <i v-if="i > 0" class="pi pi-chevron-right text-[10px] text-gray-300 shrink-0 hidden sm:block" />
              <NuxtLink v-if="crumb.to" :to="crumb.to" class="hidden sm:block text-gray-400 hover:text-gray-700 transition-colors shrink-0">{{ crumb.label }}</NuxtLink>
              <span v-else class="font-semibold text-gray-800 truncate">{{ crumb.label }}</span>
            </template>
          </nav>
          <h1 v-else class="text-base font-semibold text-gray-900 truncate">{{ pageTitle }}</h1>
        </div>
        <!-- Location lens (only for multi-site clubs, migration 237) -->
        <button v-if="locMultiSite" type="button"
          class="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-gray-200 hover:border-gray-300 text-xs font-medium text-gray-600 shrink-0 transition-colors"
          v-tooltip.bottom="'Switch location'" @click="locMenu.toggle($event)">
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: activeLocation?.color || '#94A3B8' }" />
          {{ activeLocation?.name ?? 'All locations' }}
          <i class="pi pi-chevron-down text-[9px] text-gray-400" />
        </button>
        <Menu ref="locMenu" :model="locMenuItems" popup />

        <!-- Quick create -->
        <button type="button"
          class="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-gray-500 shrink-0"
          v-tooltip.bottom="'Create'" @click="createMenu.toggle($event)">
          <i class="pi pi-plus text-base" />
        </button>
        <Menu ref="createMenu" :model="createItems" popup />

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

        <!-- Class Finder — reusable right-slide tool, opened from any screen -->
        <ClassFinderDrawer v-if="orgReady && user" />

        <!-- Share notifications — bottom-right pop when something (an event) is shared
             with the club, plus the poller that feeds them. -->
        <EventInviteNotifier v-if="orgReady && user" />
        <ShareNotifications v-if="orgReady && user" />

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

        <!-- Settings gear — club-wide config, only from the All-locations lens -->
        <NuxtLink v-if="!activeLocationId" to="/settings"
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
        <!-- Preview-as-type banner: an admin is viewing the app as a person type -->
        <div v-if="preview.active.value" class="sticky top-0 z-40 flex items-center justify-center gap-3 px-4 py-2 bg-amber-500 text-white text-sm font-medium">
          <i class="pi pi-eye text-xs" />
          <span>Previewing as <b>{{ preview.previewLabel.value }}</b> — this is what they see.</span>
          <button type="button" class="ml-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors" @click="preview.exitPreview()"><i class="pi pi-times text-[10px]" />Exit preview</button>
        </div>
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
      <NuxtLink v-for="item in mobilePrimaryForModules" :key="item.href" :to="item.href"
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
          <NuxtLink v-for="item in clubMenuForModules" :key="item.label" :to="item.href"
            class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium"
            :class="isActive(item.href) ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50'">
            <i :class="['pi', item.icon, 'text-base w-5 text-center']" />{{ item.label }}
          </NuxtLink>
          <div class="border-t border-gray-100 my-2" />
          <button v-if="orgReady && user && !gate.isDeveloper.value" type="button" class="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 text-left" @click="openReviewFromMobile"><i class="pi pi-comment text-base w-5 text-center" />Comments &amp; review<span v-if="reviewCount > 0" class="ml-auto min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">{{ reviewCount > 99 ? '99+' : reviewCount }}</span></button>
          <NuxtLink v-if="!activeLocationId" to="/settings" class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"><i class="pi pi-cog text-base w-5 text-center" />Settings</NuxtLink>
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

// ── Location lens (multi-site clubs): global active-location switcher ──
const { locations: clubLocations2, activeLocationId, activeLocation, multiSite: locMultiSite, ensureLocations, setActiveLocation, restricted: locRestricted, hasAllLocationsGrant, allowedLocationIds } = useActiveLocation()
const locMenu = ref()
const locMenuItems = computed(() => [
  // Restricted staff only get "All locations" if a grant actually spans all sites.
  ...((!locRestricted.value || hasAllLocationsGrant.value)
    ? [{ label: 'All locations', icon: activeLocationId.value === null ? 'pi pi-check' : undefined, command: () => setActiveLocation(null) }]
    : []),
  ...clubLocations2.value.filter(l => allowedLocationIds.value.includes(l.id)).map(l => ({
    label: l.name,
    icon: activeLocationId.value === l.id ? 'pi pi-check' : undefined,
    command: () => setActiveLocation(l.id),
  })),
])
watch(() => useOrg().orgId.value, () => { void ensureLocations(true) })
onMounted(() => { void ensureLocations() })
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

// Quick-create menu (top-right "+").
const createMenu = ref()
const createItems = [
  { label: 'Person', icon: 'pi pi-user', command: () => navigateTo('/people?new=1') },
  { label: 'Event', icon: 'pi pi-calendar', command: () => navigateTo('/events/new') },
  { label: 'Invoice', icon: 'pi pi-file', command: () => navigateTo('/finances') },
  { label: 'Email', icon: 'pi pi-envelope', command: () => navigateTo('/settings/communications') },
  { label: 'Notification', icon: 'pi pi-bell', command: () => navigateTo('/settings/communications') },
  { label: 'Group', icon: 'pi pi-users', command: () => navigateTo('/groups?new=1') },
]

const reviewPanel = useReviewPanel()
const notesPanel = usePersonNotesPanel()
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
const calendarApi = useWaitlistsApi() // calendars live on the MySQL seam, not Supabase
const calendars = ref<{ id: string; name: string; color: string | null; pin_to_nav: boolean; icon: string | null }[]>([])
// Calendars a club has chosen to promote to the main left menu (their own item).
const pinnedCalendars = computed(() => calendars.value.filter(c => c.pin_to_nav))
// A calendar's icon may be a full Font Awesome class (new picker, e.g.
// "fa-solid fa-futbol") or a legacy PrimeIcons suffix ("pi-calendar" / "calendar").
// Render both correctly, defaulting to a calendar glyph.
function calIconClass(icon?: string | null) {
  if (!icon) return 'pi pi-calendar'
  if (icon.includes('fa-')) return icon
  if (icon.startsWith('pi-')) return `pi ${icon}`
  return `pi pi-${icon}`
}

async function loadCalendars() {
  if (!orgId.value) { calendars.value = []; return }
  // Scope to the active org — otherwise the menu pools every org's calendars.
  const rows = await calendarApi.calendars(orgId.value).catch(() => [] as any[])
  calendars.value = rows.map((c: any) => ({ id: c.id, name: c.name, color: c.color ?? null, pin_to_nav: !!c.pinToNav, icon: c.icon ?? null }))
}

onMounted(() => { loadMenuBookables() })
// Reload calendars whenever the active org changes (incl. super-admin switch)
// or whenever a calendar is created/edited/deleted on the events board.
watch(orgId, loadCalendars, { immediate: true })
const navCalVersion = useState('nav-cal-version', () => 0)
watch(navCalVersion, loadCalendars)
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

// ── Groups flyout (Classes + saved views) ──
const groupsHover = ref(false)
let groupsLeaveTimer: ReturnType<typeof setTimeout> | null = null
function onGroupsEnter() {
  if (groupsLeaveTimer) { clearTimeout(groupsLeaveTimer); groupsLeaveTimer = null }
  groupsHover.value = true
}
function onGroupsLeave() {
  groupsLeaveTimer = setTimeout(() => { groupsHover.value = false }, 180)
}
// Fees flyout (Finances / Group Fees)
const feesHover = ref(false)
let feesLeaveTimer: any = null
function onFeesEnter() {
  if (feesLeaveTimer) { clearTimeout(feesLeaveTimer); feesLeaveTimer = null }
  feesHover.value = true
}
function onFeesLeave() {
  feesLeaveTimer = setTimeout(() => { feesHover.value = false }, 180)
}
// Bookings flyout (Bookings / Venues / Persons / Items)
const bookingsHover = ref(false)
let bookingsLeaveTimer: any = null
function onBookingsEnter() {
  if (bookingsLeaveTimer) { clearTimeout(bookingsLeaveTimer); bookingsLeaveTimer = null }
  bookingsHover.value = true
}
function onBookingsLeave() {
  bookingsLeaveTimer = setTimeout(() => { bookingsHover.value = false }, 180)
}
// People flyout (People / Admins / Organisations → /people?view=…)
const peopleHover = ref(false)
let peopleLeaveTimer: any = null
function onPeopleEnter() { if (peopleLeaveTimer) { clearTimeout(peopleLeaveTimer); peopleLeaveTimer = null } peopleHover.value = true }
function onPeopleLeave() { peopleLeaveTimer = setTimeout(() => { peopleHover.value = false }, 180) }

const gvComposable = useGroupViews()
// Shared reactive list — updates the instant a view is created/renamed/deleted.
const groupViews = gvComposable.views
async function loadGroupViews() {
  if (!orgId.value) { groupViews.value = []; return }
  await gvComposable.loadViews()
}
watch(orgId, loadGroupViews, { immediate: true })

// Shared signal so the "New calendar" menu item drops straight into the create flow on
// the events board (which owns the settings drawer) — even from another page.
const navNewCalendar = useState('nav-new-calendar', () => false)
function openNewCalendarModal() {
  eventsHover.value = false
  navNewCalendar.value = true
  navigateTo('/events')
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
  { label: 'People',      icon: 'pi-users',         href: '/people',                  chevron: true, people: true, resource: 'people' },
  { label: 'Classes',     icon: 'pi-sitemap',       href: '/groups',                  chevron: true, groups: true, module: 'groups', resource: 'groups' },
  { label: 'Fees',        icon: 'pi-dollar',        href: '/finances',                chevron: true, fees: true, module: 'finances', resource: 'fees' },
  { label: 'Memberships', icon: 'pi-id-card',       href: '/memberships',             chevron: true, module: 'finances', resource: 'fees' },
  { label: 'Events',      icon: 'pi-calendar',      href: '/events',                  chevron: true, events: true, module: 'events', resource: 'events' },
  { label: 'Bookings',    icon: 'pi-bookmark',      href: '/bookables?tab=bookings',  chevron: true, bookings: true, module: 'bookings', resource: 'bookings' },
  // Programme is no longer a hardcoded menu item — a club surfaces it as a pinned
  // calendar (e.g. "Holiday Programme") via the events calendar settings instead.
  { label: 'Attendance',  icon: 'pi-check-square',  href: '/attendance',              chevron: true, module: 'attendance', resource: 'attendance' },
  { label: 'Reports',     icon: 'pi-chart-bar',     href: '/reports',                 chevron: false },
  { label: 'Mailer',      icon: 'pi-envelope',      href: '/settings/communications', chevron: true, module: 'communications', resource: 'communications' },
  { label: 'Resources',   icon: 'pi-video',         href: '/resources',               chevron: false, module: 'resources', resource: 'resources' },
  { label: 'Assets',      icon: 'pi-shopping-cart', href: '/assets',                  chevron: true, module: 'assets', resource: 'uniforms' },
  { label: 'Mobile App',  icon: 'pi-mobile',        href: '/mobile-app',              chevron: true, module: 'mobile_app' },
  { label: 'GNZ',         icon: 'pi-user',          href: '/gnz',                     chevron: true, module: 'gnz' },
]
// Club setup (Settings → Club setup, organisations.enabled_modules): hide the
// parts of the system the club has turned off. Reactive — flipping a toggle on
// /settings/modules updates the nav live (shared useState in useOrgModules).
const orgModules = useOrgModules()
// A person's TYPE can pin an explicit menu (Settings → People & Entities → Menu
// items, person_target_types.menu_items). When any of the signed-in person's
// types configures one, that wins (union across types); otherwise the menu is
// permission-driven. Module on/off is always respected.
const typeMenuHrefs = useState<string[] | null>('fm_type_menu', () => null)
async function resolveTypeMenu() {
  typeMenuHrefs.value = null
  // Preview-as-type: use the previewed type's menu config.
  const { previewKey } = usePreviewType()
  if (previewKey.value && orgId.value) {
    const { data: pt } = await (db.from as any)('person_target_types').select('menu_items').eq('org_id', orgId.value).eq('key', previewKey.value).maybeSingle()
    typeMenuHrefs.value = Array.isArray(pt?.menu_items) ? pt.menu_items : null
    return
  }
  const email = user.value?.email
  if (!email || !orgId.value) return
  if (((user.value as any)?.app_metadata?.role) === 'super_admin') return
  const { data: person } = await (db.from as any)('persons').select('person_types, person_type').eq('org_id', orgId.value).ilike('email', email).limit(1).maybeSingle()
  if (!person) return
  const keys = (person.person_types?.length ? person.person_types : [person.person_type]).filter(Boolean)
  if (!keys.length) return
  const { data: types } = await (db.from as any)('person_target_types').select('menu_items').eq('org_id', orgId.value).in('key', keys)
  const configured = (types ?? []).filter((t: any) => Array.isArray(t.menu_items))
  if (configured.length) typeMenuHrefs.value = [...new Set(configured.flatMap((t: any) => t.menu_items as string[]))]
}
watch([orgId, user], () => { if (orgId.value) resolveTypeMenu() }, { immediate: true })

const clubMenuForModules = computed(() => {
  const base = typeMenuHrefs.value
    // Explicit per-type menu: exactly these items (still respect module on/off).
    ? clubMenu.filter(i => typeMenuHrefs.value!.includes(i.href) && orgModules.isEnabled((i as any).module))
    // Default: permission-driven.
    : clubMenu.filter(i => orgModules.isEnabled((i as any).module) && ((i as any).resource ? can((i as any).resource, 'read') : true))
  // Always give a signed-in person their own profile (their record, scoped to
  // them) — a member sees 'My Profile' even without the org-wide People permission.
  if (myPersonId.value) base.splice(1, 0, { label: 'My Profile', icon: 'pi-user', href: `/people/${myPersonId.value}#profile`, chevron: false } as any)
  // Governing bodies (NSO/Regional/Association/RST) get a cross-club managers item.
  if (isGoverningOrg.value) base.push({ label: 'Club managers', icon: 'pi-shield', href: '/managers', chevron: false } as any)
  return base
})
// A flyout sub-link shows when the type doesn't customise its menu (permission
// default) OR when that sub-link's href is in the configured set.
function menuSubVisible(href: string): boolean {
  return !typeMenuHrefs.value || typeMenuHrefs.value.includes(href)
}

// ── Icon-rail expand/collapse (remembered across pages via localStorage) ──
const railExpanded = ref(false)
onMounted(() => { try { railExpanded.value = localStorage.getItem('fm_nav_expanded') === '1' } catch {} })
watch(railExpanded, v => { try { localStorage.setItem('fm_nav_expanded', v ? '1' : '0') } catch {} })
function toggleRail() { railExpanded.value = !railExpanded.value }
// Shared button shape: full-width labelled row when expanded, centred icon when collapsed.
const railBtnClass = computed(() => railExpanded.value ? 'w-full h-10 justify-start px-3 gap-3' : 'w-10 h-10 justify-center')

// Which top-level item is expanded (one at a time).
const expandedMenu = ref<string | null>(null)
function toggleMenu(label: string) { expandedMenu.value = expandedMenu.value === label ? null : label }

// ── Mobile navigation (bottom tab bar + "More" sheet) ──
const mobilePrimary = [
  { label: 'People', icon: 'pi-users',        href: '/people' },
  { label: 'Events', icon: 'pi-calendar',     href: '/events',   module: 'events', resource: 'events' },
  { label: 'Fees',   icon: 'pi-dollar',       href: '/finances', module: 'finances', resource: 'fees' },
]
const mobilePrimaryForModules = computed(() => mobilePrimary.filter(i => orgModules.isEnabled((i as any).module) && ((i as any).resource ? can((i as any).resource, 'read') : true)))
const mobileMenuOpen = ref(false)
watch(() => route.path, () => { mobileMenuOpen.value = false })

// Permission enforcement + governing-body extras.
const { can, load: loadPerms } = useCan()
const { myPersonId, isAdmin, resolveAccessLevel } = useAccessLevel()
const preview = usePreviewType()
watch(orgId, () => { if (orgId.value) resolveAccessLevel() }, { immediate: true })
const isGoverningOrg = ref(false)
const activeOrgName = ref('')
// Brand mark shown top-left: the org's own icon, else its connected brand's icon.
const brandMark = ref<string | null>(null)
watch(orgId, async (id) => {
  loadPerms()
  if (!id) { isGoverningOrg.value = false; activeOrgName.value = ''; brandMark.value = null; return }
  orgModules.loadModules(true)
  const { data } = await (db.from as any)('organisations').select('name, org_level, icon_url, logo_url, brand_id').eq('id', id).single()
  isGoverningOrg.value = !!data?.org_level && data.org_level !== 'CLUB'
  activeOrgName.value = data?.name ?? ''
  // The club's own uploaded mark wins (square icon, else its logo); otherwise fall
  // back to the connected brand's mark (icon, else logo). null = generic glyph.
  if (data?.icon_url || data?.logo_url) {
    brandMark.value = data.icon_url || data.logo_url
  } else if (data?.brand_id) {
    const { data: brand } = await (db.from as any)('brands').select('icon_url, logo_url').eq('id', data.brand_id).maybeSingle()
    brandMark.value = brand?.icon_url || brand?.logo_url || null
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
  '/reports': 'Reports',
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

// A page can force which nav item is highlighted (e.g. a programme's editor lives
// under /events/:id but belongs to the Programme item). null = URL-based default.
const navSectionOverride = useState<string | null>('nav-section-override', () => null)
function isActive(href: string) {
  if (navSectionOverride.value) return href === navSectionOverride.value
  return route.path === href || route.path.startsWith(href + '/')
}

// A pinned calendar is "active" when the events board is scoped to it.
function isCalActive(calId: string) {
  return !navSectionOverride.value && route.path === '/events' && route.query.calendar === calId
}
const eventsModuleOn = computed(() => orgModules.isEnabled('events'))
</script>
