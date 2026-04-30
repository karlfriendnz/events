<template>
  <div class="flex flex-col transition-[padding] duration-200"
    :style="{ height: 'calc(100vh - 3.5rem)', paddingRight: showEditDialog ? (panelExpanded ? '720px' : '380px') : '0' }">

    <!-- Row 1: Pill tabs -->
    <div class="bg-white border-b border-gray-200 px-4 py-2.5 shrink-0 flex justify-center">
      <div class="flex gap-2">
        <button v-for="tab in tabs" :key="tab.key"
          class="flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-colors"
          :class="activeTab === tab.key
            ? 'bg-[#1E2157] text-white shadow-sm'
            : 'bg-[rgba(30,33,90,0.06)] text-gray-600 hover:bg-[rgba(30,33,90,0.1)]'"
          @click="activeTab = tab.key">
          <i :class="`pi ${tab.icon} text-xs`" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Row 2: Contextual actions (only when there's something to show) -->
    <div v-if="activeTab === 'bookings' || ['details','layouts'].includes(activeTab)"
      class="bg-white border-b border-gray-200 px-4 py-2 shrink-0 flex items-center justify-between gap-3">
      <template v-if="activeTab === 'bookings'">
        <div class="flex items-center gap-2">
          <Button icon="pi pi-chevron-left" severity="secondary" text size="small" @click="navPrev" />
          <span class="text-sm font-medium text-gray-700 min-w-36 text-center">{{ activeCalView === 'scheduler' ? schedulerTitle : calTitle }}</span>
          <Button icon="pi pi-chevron-right" severity="secondary" text size="small" @click="navNext" />
          <Button label="Today" severity="secondary" outlined size="small" @click="navToday" />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <!-- Search slide-out -->
          <div class="relative flex items-center">
            <transition name="slide-search">
              <IconField v-if="bookingsSearchOpen" class="mr-1.5">
                <InputIcon class="pi pi-search" />
                <InputText ref="bookingsSearchInput" v-model="bookingsSearch"
                  placeholder="Search bookings…" size="small" class="w-56"
                  @blur="onBookingsSearchBlur" />
              </IconField>
            </transition>
            <Button :icon="bookingsSearchOpen && bookingsSearch ? 'pi pi-times' : 'pi pi-search'"
              severity="secondary" outlined size="small"
              v-tooltip.bottom="'Search bookings'"
              @click="onBookingsSearchToggle" />
          </div>
          <Select v-model="activeCalView" :options="calViews"
            option-label="label" option-value="value" size="small" class="w-32"
            @update:model-value="setCalView" />
          <Button label="New Booking" icon="pi pi-plus" size="small"
            @click="openNewBooking(null)" style="background:#1E2157;border-color:#1E2157" />
          <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small" @click="e => moreMenu.toggle(e)" />
          <Menu ref="moreMenu" :model="moreMenuItems" :popup="true" />
        </div>
      </template>
      <template v-else-if="['details','layouts'].includes(activeTab)">
        <div />
        <div class="flex items-center gap-2">
          <Button label="Save changes" icon="pi pi-check" size="small"
            :loading="editorRef?.saving" :disabled="loading"
            @click="editorRef?.save()" style="background:#1E2157;border-color:#1E2157" />
          <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small" @click="e => moreMenu.toggle(e)" />
          <Menu ref="moreMenu" :model="moreMenuItems" :popup="true" />
        </div>
      </template>
    </div>

    <!-- Content -->
    <div class="flex-1 min-h-0 bg-[#F5F8FA] overflow-hidden">

      <!-- Bookings tab -->
      <div v-if="activeTab === 'bookings'" class="h-full flex flex-col">
        <!-- Temporarily closed banner -->
        <div v-if="venue?.closed_from || venue?.closed_until" class="mx-4 mt-4 shrink-0 rounded-lg bg-amber-50 border border-amber-200 px-4 py-2 flex items-center gap-2">
          <i class="pi pi-ban text-amber-500 text-xs shrink-0" />
          <p class="flex-1 text-xs text-amber-800">
            <span class="font-semibold">Temporarily closed</span>
            <template v-if="venue.closed_from && venue.closed_until"> · {{ new Date(venue.closed_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }} – {{ new Date(venue.closed_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}</template>
            <template v-else-if="venue.closed_from"> · from {{ new Date(venue.closed_from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}</template>
            <template v-else-if="venue.closed_until"> · until {{ new Date(venue.closed_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}</template>
            <span v-if="venue.closure_reason"> · {{ venue.closure_reason }}</span>
          </p>
          <button class="text-xs font-semibold text-amber-700 hover:text-amber-900 shrink-0" @click="activeTab = 'availability'">Manage</button>
        </div>
        <BookingsCalendar v-if="activeCalView !== 'scheduler'"
          class="flex-1 min-h-0"
          :bookable-id="id"
          :cal-date="calDate"
          :cal-view="calView"
          :refresh-key="bookingsRefreshKey"
          @booking-click="openEditBooking"
          @slot-click="openNewBooking"
          @booking-hover="onBookingHover"
          @booking-leave="hideBookingTooltip"
        />
        <SubVenueScheduler v-else class="flex-1 min-h-0" :children="children" :date="schedulerDate"
          @booking-click="openEditBooking"
          @new-booking="openSchedulerBooking" />
      </div>

      <!-- Editor tabs (Details / Layouts) -->
      <div v-else-if="venue && ['details','layouts'].includes(activeTab)" class="h-full flex flex-col">

        <!-- Layouts inheritance banner -->
        <div v-if="activeTab === 'layouts' && venue?.master_id" class="mx-6 mt-6 mb-0 rounded-xl border overflow-hidden"
          :class="sectionInherited('layouts') ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'">
          <div class="flex items-center gap-3 px-4 py-3">
            <i class="pi text-sm" :class="sectionInherited('layouts') ? 'pi-lock text-violet-500' : 'pi-lock-open text-amber-500'" />
            <span class="text-sm flex-1" :class="sectionInherited('layouts') ? 'text-violet-700' : 'text-amber-700'">
              <template v-if="sectionInherited('layouts')">Layouts inherited from <strong>{{ masterName }}</strong>.</template>
              <template v-else>Layouts customised locally.</template>
            </span>
            <button class="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors bg-white"
              :class="sectionInherited('layouts') ? 'border-violet-300 text-violet-700 hover:bg-violet-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100'"
              @click="toggleSectionInheritance('layouts')">
              {{ sectionInherited('layouts') ? 'Customise' : 'Reset to master' }}
            </button>
          </div>
        </div>
        <BookableEditor
          ref="editorRef"
          :bookable="venue"
          :all-bookables="allBookables"
          :standalone="true"
          :initial-tab="activeTab"
          @saved="onSaved"
          @delete="onDelete"
          @set-role="setVenueRole"
          @navigate-tab="tab => activeTab = tab"
          class="flex-1 min-h-0"
        />
      </div>

      <!-- Items tab -->
      <div v-else-if="activeTab === 'items'" class="h-full overflow-y-auto p-6">
        <div class="max-w-[1140px] mx-auto">
          <div class="flex justify-between mb-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items</h3>
            <div class="flex gap-2">
              <Button label="Add existing" icon="pi pi-link" size="small" severity="secondary" outlined
                @click="openAddExisting" />
              <Button label="Create new" icon="pi pi-plus" size="small"
                @click="createChildBookable('ITEM')"
                style="background:#1E2157; border-color:#1E2157" />
            </div>
          </div>
          <div v-if="!items.length" class="text-center py-16 text-gray-400">
            <i class="pi pi-box text-3xl mb-3 block text-gray-300" />
            <p class="text-sm">No items attached yet. Add existing items or create a new one.</p>
          </div>
          <div v-else class="grid grid-cols-3 gap-4">
            <div v-for="item in items" :key="item.id" class="relative group">
              <NuxtLink :to="`/bookables/${item.id}`"
                class="block bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1E2157] hover:shadow-sm transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center shrink-0">
                    <i class="pi pi-box text-white text-xs" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-gray-900 text-sm truncate">{{ item.name }}</p>
                    <p v-if="item.item_category" class="text-xs text-gray-400">{{ item.item_category }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <Tag :value="item.status" :severity="statusSeverity(item.status)" class="text-xs" />
                  <span v-if="item.max_concurrent" class="text-xs text-gray-400">× {{ item.max_concurrent }}</span>
                </div>
              </NuxtLink>
              <button class="absolute top-2 right-2 w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200"
                title="Unlink item" @click.prevent="unlinkItem(item)">
                <i class="pi pi-times text-[10px] text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Availability tab -->
      <div v-else-if="activeTab === 'availability'" class="h-full overflow-y-auto">
        <!-- Inheritance banner -->
        <div v-if="venue?.master_id" class="mx-6 mt-6 rounded-xl border overflow-hidden"
          :class="sectionInherited('availability') ? 'border-violet-200 bg-violet-50' : 'border-amber-200 bg-amber-50'">
          <div class="flex items-center gap-3 px-4 py-3">
            <i class="pi text-sm" :class="sectionInherited('availability') ? 'pi-lock text-violet-500' : 'pi-lock-open text-amber-500'" />
            <span class="text-sm flex-1" :class="sectionInherited('availability') ? 'text-violet-700' : 'text-amber-700'">
              <template v-if="sectionInherited('availability')">Availability inherited from <strong>{{ masterName }}</strong>.</template>
              <template v-else>Availability customised locally.</template>
            </span>
            <button class="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors bg-white"
              :class="sectionInherited('availability') ? 'border-violet-300 text-violet-700 hover:bg-violet-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100'"
              @click="toggleSectionInheritance('availability')">
              {{ sectionInherited('availability') ? 'Customise' : 'Reset to master' }}
            </button>
          </div>
        </div>
        <AvailabilityEditor
          :bookable-id="sectionInherited('availability') && venue?.master_id ? venue.master_id : id"
          :readonly="sectionInherited('availability') && !!venue?.master_id"
          @saved="onScheduleSaved"
        />
      </div>

      <!-- Sub-venues tab -->
      <div v-else-if="activeTab === 'sub-venues'" class="h-full overflow-y-auto p-6">
        <div class="max-w-[1140px] mx-auto">
          <div class="flex justify-between mb-4">
            <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sub-venues</h3>
            <Button label="Add Sub-venue" icon="pi pi-plus" size="small"
              @click="createChildBookable('VENUE')"
              style="background:#1E2157; border-color:#1E2157" />
          </div>
          <div v-if="!children.length" class="text-center py-16 text-gray-400">
            <i class="pi pi-sitemap text-3xl mb-3 block text-gray-300" />
            <p class="text-sm">No sub-venues yet.</p>
          </div>
          <div v-else class="grid grid-cols-3 gap-4">
            <div v-for="child in children" :key="child.id" class="relative group">
              <NuxtLink :to="`/bookables/${child.id}`"
                class="block bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1E2157] hover:shadow-sm transition-all">
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-8 h-8 rounded-lg bg-[#1E2157] flex items-center justify-center shrink-0">
                    <i class="pi pi-building text-white text-xs" />
                  </div>
                  <p class="font-medium text-gray-900 text-sm">{{ child.name }}</p>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-400">
                  <i class="pi pi-users" />
                  <span>Capacity {{ child.max_concurrent || '—' }}</span>
                </div>
                <div v-if="child.location" class="text-xs text-gray-400 mt-1">
                  <i class="pi pi-map-marker mr-1" />{{ child.location }}
                </div>
              </NuxtLink>
              <button class="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
                title="Duplicate" @click.prevent="duplicateVenue(child)">
                <i class="pi pi-copy text-xs text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Add existing items dialog -->
    <Dialog v-model:visible="showAddExisting" header="Add existing items" modal style="width: 520px">
      <div class="space-y-3">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="existingSearch" placeholder="Search items…" class="w-full" autofocus />
        </IconField>
        <div class="max-h-80 overflow-y-auto space-y-1 border border-gray-100 rounded-lg">
          <div v-if="!filteredExistingItems.length" class="text-center py-8 text-sm text-gray-400">
            No unlinked items found.
          </div>
          <label v-for="exItem in filteredExistingItems" :key="exItem.id"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
            <Checkbox v-model="selectedExistingIds" :value="exItem.id" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-900">{{ exItem.name }}</p>
              <p class="text-xs text-gray-400">{{ exItem.item_category || 'No category' }}</p>
            </div>
            <Tag :value="exItem.status" :severity="statusSeverity(exItem.status)" class="text-xs" />
          </label>
        </div>
        <p class="text-xs text-gray-400">{{ selectedExistingIds.length }} selected</p>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showAddExisting = false" />
        <Button label="Add selected" icon="pi pi-check" :disabled="!selectedExistingIds.length"
          :loading="linkingSaving" @click="linkSelectedItems"
          style="background:#1E2157; border-color:#1E2157" />
      </template>
    </Dialog>

    <!-- Edit booking drawer (slides in from the right; calendar stays visible) -->
    <Drawer v-model:visible="showEditDialog" position="right" :modal="false" :dismissable="false"
      :style="{ width: panelExpanded ? '720px' : '380px' }"
      :pt="{
        root: { class: 'transition-[width] duration-200' },
        header: { class: 'hidden' },
        content: { class: 'p-0 overflow-visible' },
        mask: { class: 'pointer-events-none' },
      }">
      <div v-if="editingBooking" class="flex flex-col h-full">
        <!-- Coloured banner header -->
        <div class="relative px-7 pt-7 pb-6 overflow-hidden text-white"
          :style="{ background: `linear-gradient(135deg, ${editingBookingHeaderColor} 0%, ${editingBookingHeaderColor}DD 60%, #0f1230 130%)` }">
          <i class="pi pi-calendar absolute -right-4 -top-4 text-white/10" style="font-size:140px" />
          <div class="relative flex items-start gap-4">
            <div class="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
              <i :class="`pi ${editingBooking?.type === 'EVENT_DRIVEN' ? 'pi-calendar-plus' : 'pi-bookmark'} text-lg`" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-80">
                <span>{{ editingBooking?.type === 'EVENT_DRIVEN' ? 'Event booking' : 'Standalone booking' }}</span>
                <span v-if="editingBooking?.activity_mode" class="px-2 py-0.5 rounded-full bg-white/15">{{ editingBooking.activity_mode.name }}</span>
              </div>
              <h2 class="text-xl font-semibold mt-1 leading-tight truncate">{{ editingBooking?.event?.title || editingBooking?.notes || 'Booking' }}</h2>
              <div class="flex items-center gap-2 text-xs mt-1.5 opacity-90">
                <i class="pi pi-clock text-[10px]" />
                <span>{{ editingBookingDateLabel }}</span>
                <span v-if="editingBookingTimeLabel" class="opacity-70">· {{ editingBookingTimeLabel }}</span>
              </div>
            </div>
            <div class="absolute top-3 right-3 flex items-center gap-1.5">
              <button class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                @click="panelExpanded = !panelExpanded"
                v-tooltip.left="panelExpanded ? 'Compact view' : 'Expand panel'">
                <i :class="panelExpanded ? 'pi pi-window-minimize' : 'pi pi-window-maximize'" class="text-xs" />
              </button>
              <button class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                @click="showEditDialog = false"
                v-tooltip.left="'Close'">
                <i class="pi pi-times text-xs" />
              </button>
            </div>
          </div>
        </div>

        <!-- Single scrollable body (no tabs) -->
        <div class="px-7 pt-6 pb-6 bg-white border-t border-gray-100 overflow-y-auto space-y-7 flex-1 min-h-0">

          <!-- Pending → approve / decline action banner -->
          <section v-if="editingBooking?.status === 'PENDING'"
            class="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-center gap-3">
            <i class="pi pi-clock text-amber-500 shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-amber-900">Awaiting your approval</p>
              <p class="text-xs text-amber-700/80">This booking is currently pending. Approve to confirm the slot, or decline to free it up.</p>
            </div>
            <Button label="Decline" icon="pi pi-times" size="small" severity="danger" outlined
              :loading="savingEdit" @click="declineBooking" />
            <Button label="Approve" icon="pi pi-check" size="small"
              :loading="savingEdit" @click="approveBooking"
              style="background:#10b981;border-color:#10b981" />
          </section>

          <!-- Status pill row -->
          <section>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><i class="pi pi-flag text-[10px] text-gray-400" />Status</div>
            <div class="flex gap-1.5 mt-2">
              <button v-for="s in bookingStatuses" :key="s.value"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                :class="editForm.status === s.value
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'"
                :style="editForm.status === s.value ? { background: s.color } : {}"
                @click="editForm.status = s.value">
                <span class="w-1.5 h-1.5 rounded-full"
                  :style="{ background: editForm.status === s.value ? '#ffffff' : s.color }" />
                {{ s.label }}
              </button>
            </div>
          </section>

          <!-- When + Attendees -->
          <section>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><i class="pi pi-clock text-[10px] text-gray-400" />When</div>
            <div class="grid grid-cols-3 gap-3 mt-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] text-gray-500">Start</label>
                <DatePicker v-model="editForm.start_at" show-time hour-format="12" size="small" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] text-gray-500">End</label>
                <DatePicker v-model="editForm.end_at" show-time hour-format="12" size="small" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] text-gray-500">Attendees</label>
                <InputNumber v-model="editForm.attendee_count" :min="0" size="small" />
              </div>
            </div>
          </section>

          <!-- Activity & Mode -->
          <section>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><i class="pi pi-bolt text-[10px] text-gray-400" />Activity</div>
            <div class="grid grid-cols-2 gap-3 mt-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] text-gray-500">Activity</label>
                <Select v-model="editForm.activity_id" :options="venueActivities"
                  option-label="name" option-value="id" placeholder="None" show-clear class="w-full">
                  <template #option="{ option }">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#6366f1' }" />
                      <span>{{ option.name }}</span>
                    </div>
                  </template>
                </Select>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] text-gray-500">Mode</label>
                <Select v-model="editForm.activity_mode_id" :options="modesForActivity"
                  option-label="name" option-value="id" :placeholder="modesForActivity.length ? 'Pick a mode' : 'No modes'" show-clear class="w-full">
                  <template #option="{ option }">
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#6366f1' }" />
                      <span>{{ option.name }}</span>
                    </div>
                  </template>
                </Select>
              </div>
            </div>

            <!-- Mode's linked form fields (renders the form the customer filled in) -->
            <div v-if="modeFormFields.length" class="rounded-xl border border-gray-200 bg-gray-50/40 p-4 space-y-3 mt-3">
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Form responses</p>
              <div class="grid grid-cols-2 gap-3">
                <div v-for="f in modeFormFields" :key="f.id" class="flex flex-col gap-1.5"
                  :class="f._col_span === 1 ? 'col-span-1' : 'col-span-2'">
                  <label class="text-xs font-medium text-gray-600">
                    {{ f.label }}
                    <span v-if="f.is_required" class="text-red-400">*</span>
                  </label>
                  <Textarea v-if="f.field_type === 'LONG_TEXT'"
                    v-model="editForm.custom_fields[f.id]" rows="2" auto-resize
                    :placeholder="f.placeholder ?? ''" class="w-full text-sm" />
                  <select v-else-if="f.field_type === 'SINGLE_SELECT'"
                    v-model="editForm.custom_fields[f.id]"
                    class="h-9 px-3 text-sm border border-gray-200 rounded-lg outline-none bg-white">
                    <option value="">—</option>
                    <option v-for="opt in f._options" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <label v-else-if="f.field_type === 'TOGGLE'" class="flex items-center gap-2 text-sm">
                    <input type="checkbox" v-model="editForm.custom_fields[f.id]" class="rounded border-gray-300" />
                    <span>{{ f.placeholder || 'Yes' }}</span>
                  </label>
                  <input v-else
                    v-model="editForm.custom_fields[f.id]"
                    :type="f.field_type === 'NUMBER' ? 'number' : f.field_type === 'DATE' ? 'date' : 'text'"
                    :placeholder="f.placeholder ?? ''"
                    class="h-9 rounded-lg border border-gray-300 px-3 text-sm" />
                </div>
              </div>
            </div>
            <div v-else-if="editForm.activity_mode_id && !modeFormLoading"
              class="rounded-xl border border-dashed border-[#1E2157]/30 bg-[#EFF6FF]/40 px-4 py-3 flex items-start gap-3 mt-3">
              <i class="pi pi-sparkles text-[#1E2157] mt-0.5" />
              <div>
                <p class="text-xs font-medium text-[#1E2157]">No form linked to this mode</p>
                <p class="text-[11px] text-[#1E2157]/70 mt-0.5">Configure a booking form on the mode to ask custom questions.</p>
              </div>
            </div>

            <!-- Payment + terms snapshot saved at booking time -->
            <div v-if="bookingPaymentMethodLabel || bookingTermsAgreed.length"
              class="rounded-xl border border-gray-200 bg-gray-50/40 p-4 space-y-3 mt-3">
              <p class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Payment &amp; consent</p>
              <div v-if="bookingPaymentMethodLabel" class="flex items-center gap-2">
                <i class="pi pi-credit-card text-gray-400 text-xs" />
                <span class="text-xs text-gray-500">Selected payment method:</span>
                <span class="text-sm font-medium text-gray-800">{{ bookingPaymentMethodLabel }}</span>
              </div>
              <div v-if="bookingTermsAgreed.length" class="space-y-1.5">
                <div v-for="(t, i) in bookingTermsAgreed" :key="i" class="flex items-start gap-2">
                  <i class="pi text-xs mt-0.5"
                    :class="t.agreed ? 'pi-check-circle text-green-500' : 'pi-times-circle text-gray-300'" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-gray-700">{{ t.label || 'Terms' }}</p>
                    <p v-if="t.at" class="text-[10px] text-gray-400">Agreed {{ new Date(t.at).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Location -->
          <section>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><i class="pi pi-map-marker text-[10px] text-gray-400" />Location</div>
            <div class="rounded-xl border border-gray-200 p-3 flex items-center gap-3 mt-2">
              <div class="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                <i class="pi pi-map-marker text-[#1E2157] text-sm" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Currently at</p>
                <p class="text-sm font-semibold text-gray-800 truncate">{{ venue?.name ?? 'this venue' }}</p>
              </div>
              <Select v-model="editForm.bookable_id" :options="moveTargets"
                option-label="name" option-value="id" placeholder="Move to…" filter show-clear class="w-44">
                <template #option="{ option }">
                  <div class="flex items-center gap-2">
                    <i :class="`pi ${option.type === 'PERSON' ? 'pi-user' : option.type === 'ITEM' ? 'pi-box' : 'pi-building'} text-xs text-gray-400`" />
                    <span>{{ option.name }}</span>
                  </div>
                </template>
              </Select>
            </div>
          </section>

          <!-- Contact -->
          <section>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><i class="pi pi-user text-[10px] text-gray-400" />Contact</div>
            <div class="rounded-xl border border-gray-200 p-4 flex items-start gap-3 mt-2">
              <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-500 font-semibold text-sm">
                {{ contactInitial }}
              </div>
              <div class="flex-1 grid grid-cols-1 gap-2">
                <InputText v-model="editForm.contact_name" placeholder="Name" size="small" />
                <div class="grid grid-cols-2 gap-2">
                  <IconField>
                    <InputIcon class="pi pi-envelope" />
                    <InputText v-model="editForm.contact_email" placeholder="Email" size="small" class="w-full" />
                  </IconField>
                  <IconField>
                    <InputIcon class="pi pi-phone" />
                    <InputText v-model="editForm.contact_phone" placeholder="Phone" size="small" class="w-full" />
                  </IconField>
                </div>
              </div>
            </div>
          </section>

          <!-- Notes -->
          <section>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><i class="pi pi-align-left text-[10px] text-gray-400" />Notes</div>
            <Textarea v-model="editForm.notes" rows="3" auto-resize placeholder="Anything worth remembering…"
              class="w-full mt-2" />
          </section>

          <!-- Notify actions -->
          <section>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><i class="pi pi-bell text-[10px] text-gray-400" />Notify</div>
            <div class="grid grid-cols-2 gap-3 mt-2">
              <button class="text-left rounded-xl border border-gray-200 hover:border-[#1E2157]/40 hover:shadow-sm transition-all p-3 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!editForm.contact_email"
                @click="notifyEmail">
                <div class="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                  <i class="pi pi-envelope text-[#1E2157] text-sm" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-gray-800">Email contact</p>
                  <p class="text-[11px] text-gray-500 truncate">{{ editForm.contact_email || 'No email on file' }}</p>
                </div>
              </button>
              <button class="text-left rounded-xl border border-gray-200 hover:border-[#1E2157]/40 hover:shadow-sm transition-all p-3 flex items-center gap-3"
                @click="notifyApp">
                <div class="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                  <i class="pi pi-bell text-amber-600 text-sm" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-gray-800">In-app notification</p>
                  <p class="text-[11px] text-gray-500 truncate">Ping the booking owner</p>
                </div>
              </button>
            </div>
          </section>
        </div>

        <!-- Footer actions -->
        <div class="border-t border-gray-100 bg-white px-5 py-3 flex items-center justify-between shrink-0">
          <Button label="Delete" icon="pi pi-trash" severity="danger" text size="small" @click="deleteBooking" />
          <div class="flex gap-2">
            <Button label="Close" severity="secondary" outlined size="small" @click="showEditDialog = false" />
            <Button label="Save changes" icon="pi pi-check" size="small" :loading="savingEdit"
              @click="saveEditBooking" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>
      </div>
    </Drawer>

    <Toast />

    <!-- Booking hover popup -->
    <ClientOnly>
      <Teleport to="body">
        <div v-if="bookingTooltip.visible" class="fixed z-50 pointer-events-none"
          :style="{ top: bookingTooltip.y + 'px', left: bookingTooltip.x + 'px' }">
          <div class="bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden w-72">
            <div class="h-1.5" :style="{ background: bookingTooltip.booking?._headerColor || '#1E2157' }" />
            <div class="p-4 space-y-1.5 text-xs">
              <p class="font-semibold text-gray-900 text-sm leading-snug">{{ bookingTooltip.booking?.event?.title || bookingTooltip.booking?.notes || 'Booking' }}</p>
              <div class="flex items-center gap-2 text-gray-500">
                <i class="pi pi-calendar w-3.5 shrink-0" />
                <span>{{ bookingTooltip.dateLabel }}</span>
                <span class="text-gray-400">{{ bookingTooltip.timeLabel }}</span>
              </div>
              <div v-if="bookingTooltip.booking?.activity_mode" class="flex items-center gap-2 text-gray-500">
                <i class="pi pi-bolt w-3.5 shrink-0" />
                <span class="px-2 py-0.5 rounded-full font-medium text-white text-[11px]"
                  :style="{ background: bookingTooltip.booking.activity_mode.color || '#6366f1' }">
                  {{ bookingTooltip.booking.activity_mode.name }}
                </span>
              </div>
              <div v-if="bookingTooltip.booking?.contact_name" class="flex items-center gap-2 text-gray-500">
                <i class="pi pi-user w-3.5 shrink-0" />
                <span>{{ bookingTooltip.booking.contact_name }}</span>
              </div>
              <div v-if="bookingTooltip.booking?.notes && bookingTooltip.booking?.event?.title"
                class="flex items-start gap-2 text-gray-500 pt-1 border-t border-gray-100">
                <i class="pi pi-align-left w-3.5 shrink-0 mt-0.5" />
                <span class="line-clamp-2 leading-relaxed">{{ bookingTooltip.booking.notes }}</span>
              </div>
              <div class="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                <span class="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full"
                  :class="bookingTooltip.booking?.type === 'EVENT_DRIVEN' ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'">
                  {{ bookingTooltip.booking?.type === 'EVENT_DRIVEN' ? 'Event' : 'Booking' }}
                </span>
                <span class="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full"
                  :class="bookingTooltip.booking?.status === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
                  {{ bookingTooltip.booking?.status }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { useOrg } from '~/composables/useOrg'

const { orgId, orgReady } = useOrg()
const router = useRouter()

const db = useDb()
const toast = useToast()
const route = useRoute()
const id = route.params.id as string
const breadcrumbs = useBreadcrumbs()

const venue = ref<any>(null)
const parentVenue = ref<any>(null)
const children = ref<any[]>([])
const allBookables = ref<any[]>([])
const linkedItems = ref<any[]>([])
const syncing = ref(false)
const loading = ref(true)
const moreMenu = ref()
const editorRef = ref<any>(null)
const activeTab = ref((route.query.tab as string) || (route.query.new ? 'details' : 'bookings'))
const linkedMasterId = ref<string | null>(null)

async function createChildBookable(type: 'VENUE' | 'ITEM') {
  if (!venue.value || !orgId.value) return
  const { data, error } = await (db.from as any)('bookables').insert({
    org_id: orgId.value,
    name: type === 'ITEM' ? 'Untitled Item' : 'Untitled Sub-venue',
    type,
    status: 'DRAFT',
    max_concurrent: 1,
    parent_id: venue.value.id,
  }).select('id').single()
  if (error || !data?.id) {
    toast.add({ severity: 'error', summary: 'Could not create', detail: error?.message ?? 'Unknown error', life: 4000 })
    return
  }
  await navigateTo(`/bookables/${data.id}?new=1`)
}

const masterName = computed(() =>
  allBookables.value.find(b => b.id === venue.value?.master_id)?.name ?? 'master'
)

const availableMasters = computed(() =>
  allBookables.value.filter(b => b.is_master && b.id !== id && b.status !== 'DELETED' && b.status !== 'ARCHIVED')
)

// Section inheritance helpers
function sectionInherited(section: string) {
  return !!(venue.value?.master_id) && !(venue.value?.customized_sections ?? []).includes(section)
}

async function toggleSectionInheritance(section: string) {
  if (!venue.value) return
  const current: string[] = venue.value.customized_sections ?? []
  let next: string[]
  if (current.includes(section)) {
    // Reset to master: remove from customized list, pull master data for this section
    next = current.filter(s => s !== section)
    await pullSectionFromMaster(section)
  } else {
    // Customise: add to list so master propagation skips this venue for this section
    next = [...current, section]
  }
  await db.from('bookables').update({ customized_sections: next }).eq('id', id)
  venue.value = { ...venue.value, customized_sections: next }
}

async function pullSectionFromMaster(section: string) {
  if (!venue.value?.master_id) return
  const masterId = venue.value.master_id

  if (section === 'layouts') {
    const { data: masterLayouts } = await (db.from as any)('bookable_layouts')
      .select('*, bookable_layout_modes(*)')
      .eq('bookable_id', masterId)
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', id)
    if (masterLayouts?.length) {
      const { data: newLayouts } = await (db.from as any)('bookable_layouts')
        .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, bookable_layout_modes: ____, ...rest }: any) => ({ ...rest, bookable_id: id })))
        .select()
      if (newLayouts) {
        const modeRows: any[] = []
        newLayouts.forEach((nl: any, i: number) => {
          ;(masterLayouts[i].bookable_layout_modes ?? []).forEach((m: any) => {
            modeRows.push({ layout_id: nl.id, name: m.name, description: m.description, min_players: m.min_players, max_players: m.max_players, price: m.price, price_type: m.price_type, sort_order: m.sort_order })
          })
        })
        if (modeRows.length) await (db.from as any)('bookable_layout_modes').insert(modeRows)
      }
    }
  }

  if (section === 'availability') {
    const { data: avRules } = await (db.from as any)('availability_rules').select('*').eq('bookable_id', masterId)
    await (db.from as any)('availability_rules').delete().eq('bookable_id', id)
    if (avRules?.length) {
      await (db.from as any)('availability_rules').insert(
        avRules.map(({ id: _, bookable_id: __, created_at: ___, ...rest }: any) => ({ ...rest, bookable_id: id }))
      )
    }
  }

  if (section === 'schedule') {
    const { data: wins } = await (db.from as any)('booking_windows').select('*, booking_window_slots(*)').eq('bookable_id', masterId)
    await (db.from as any)('booking_windows').delete().eq('bookable_id', id)
    if (wins?.length) {
      const { data: newWins } = await (db.from as any)('booking_windows')
        .insert(wins.map(({ id: _, bookable_id: __, created_at: ___, booking_window_slots: ____, ...rest }: any) => ({ ...rest, bookable_id: id })))
        .select()
      if (newWins) {
        const slotRows: any[] = []
        newWins.forEach((nw: any, i: number) => {
          ;(wins[i].booking_window_slots ?? []).forEach((s: any) => {
            slotRows.push({ window_id: nw.id, slot_start: s.slot_start, slot_end: s.slot_end, capacity: s.capacity, label: s.label, sort_order: s.sort_order })
          })
        })
        if (slotRows.length) await (db.from as any)('booking_window_slots').insert(slotRows)
      }
    }
  }
}

// Propagate a section from this master to all linked venues that haven't customised it
async function propagateSectionToLinked(section: string) {
  if (!venue.value?.is_master || !linkedItems.value.length) return
  const targets = linkedItems.value.filter(l => !(l.customized_sections ?? []).includes(section))
  for (const target of targets) {
    const savedMasterId = venue.value.master_id
    // Temporarily treat this venue as the master for propagation
    venue.value = { ...venue.value!, master_id: null }
    await pullSectionFromMaster.call({ venue: { value: { ...target, master_id: id } } }, section)
    venue.value = { ...venue.value!, master_id: savedMasterId }
  }
  // Simpler: re-use the copy logic directly
  await propagateSection(section, targets.map(t => t.id))
}

async function propagateSection(section: string, targetIds: string[]) {
  if (!targetIds.length) return

  if (section === 'layouts') {
    const { data: masterLayouts } = await (db.from as any)('bookable_layouts')
      .select('*, bookable_layout_modes(*)')
      .eq('bookable_id', id)
    for (const tid of targetIds) {
      await (db.from as any)('bookable_layouts').delete().eq('bookable_id', tid)
      if (masterLayouts?.length) {
        const { data: newLayouts } = await (db.from as any)('bookable_layouts')
          .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, bookable_layout_modes: ____, ...rest }: any) => ({ ...rest, bookable_id: tid })))
          .select()
        if (newLayouts) {
          const modeRows: any[] = []
          newLayouts.forEach((nl: any, i: number) => {
            ;(masterLayouts[i].bookable_layout_modes ?? []).forEach((m: any) => {
              modeRows.push({ layout_id: nl.id, name: m.name, description: m.description, min_players: m.min_players, max_players: m.max_players, price: m.price, price_type: m.price_type, sort_order: m.sort_order })
            })
          })
          if (modeRows.length) await (db.from as any)('bookable_layout_modes').insert(modeRows)
        }
      }
    }
  }

  if (section === 'schedule') {
    const { data: wins } = await (db.from as any)('booking_windows').select('*, booking_window_slots(*)').eq('bookable_id', id)
    for (const tid of targetIds) {
      await (db.from as any)('booking_windows').delete().eq('bookable_id', tid)
      if (wins?.length) {
        const { data: newWins } = await (db.from as any)('booking_windows')
          .insert(wins.map(({ id: _, bookable_id: __, created_at: ___, booking_window_slots: ____, ...rest }: any) => ({ ...rest, bookable_id: tid })))
          .select()
        if (newWins) {
          const slotRows: any[] = []
          newWins.forEach((nw: any, i: number) => {
            ;(wins[i].booking_window_slots ?? []).forEach((s: any) => {
              slotRows.push({ window_id: nw.id, slot_start: s.slot_start, slot_end: s.slot_end, capacity: s.capacity, label: s.label, sort_order: s.sort_order })
            })
          })
          if (slotRows.length) await (db.from as any)('booking_window_slots').insert(slotRows)
        }
      }
    }
  }
}

async function setVenueRole(role: 'standalone' | 'master' | 'linked') {
  if (!venue.value) return
  const updates: any = { is_master: false, master_id: null }
  if (role === 'master') updates.is_master = true
  await db.from('bookables').update(updates).eq('id', id)
  venue.value = { ...venue.value, ...updates }
  if (role === 'linked' && updates.master_id) {
    for (const section of ['layouts', 'schedule']) {
      if (!sectionInherited(section)) continue
      await pullSectionFromMaster(section)
    }
  }
  await loadLinked()
}

async function changeMaster(newMasterId: string) {
  if (!venue.value) return
  await db.from('bookables').update({ master_id: newMasterId }).eq('id', id)
  venue.value = { ...venue.value, master_id: newMasterId }
  for (const section of ['layouts', 'schedule']) {
    if (sectionInherited(section)) await pullSectionFromMaster(section)
  }
}

// ── Items tab ─────────────────────────────────────────────────
const items = ref<any[]>([])
const showAddExisting = ref(false)
const existingSearch = ref('')
const allUnlinkedItems = ref<any[]>([])
const selectedExistingIds = ref<string[]>([])
const linkingSaving = ref(false)

const filteredExistingItems = computed(() => {
  const q = existingSearch.value.toLowerCase()
  return allUnlinkedItems.value.filter(i =>
    !q || i.name.toLowerCase().includes(q) || (i.item_category ?? '').toLowerCase().includes(q)
  )
})

async function openAddExisting() {
  existingSearch.value = ''
  selectedExistingIds.value = []
  const linkedIds = new Set(items.value.map(i => i.id))
  const { data } = await db.from('bookables').select('*').eq('type', 'ITEM').eq('status', 'ACTIVE').order('name')
  allUnlinkedItems.value = (data ?? []).filter(i => !linkedIds.has(i.id))
  showAddExisting.value = true
}

async function linkSelectedItems() {
  if (!selectedExistingIds.value.length) return
  linkingSaving.value = true
  await db.from('bookables').update({ parent_id: id }).in('id', selectedExistingIds.value)
  linkingSaving.value = false
  showAddExisting.value = false
  await loadItems()
  toast.add({ severity: 'success', summary: `${selectedExistingIds.value.length} item(s) linked`, life: 2000 })
}

async function unlinkItem(item: any) {
  if (!confirm(`Unlink "${item.name}" from this bookable?`)) return
  await db.from('bookables').update({ parent_id: null }).eq('id', item.id)
  await loadItems()
  toast.add({ severity: 'success', summary: 'Item unlinked', life: 2000 })
}

const calDate = ref(new Date())
const calView = ref<'day' | 'week' | 'month' | 'list'>('week')
const bookingsRefreshKey = ref(0)

const weekDaysForTitle = computed(() => {
  const dow = (calDate.value.getDay() + 6) % 7
  const monday = new Date(calDate.value)
  monday.setDate(calDate.value.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
})

const calTitle = computed(() => {
  if (calView.value === 'month' || calView.value === 'list')
    return calDate.value.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  if (calView.value === 'week') {
    const days = weekDaysForTitle.value
    return `${days[0].toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  return calDate.value.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
})

const calViews = computed(() => [
  { label: 'Month', value: 'month' },
  { label: 'Week',  value: 'week' },
  { label: 'Day',   value: 'day' },
  { label: 'List',  value: 'list' },
  ...(children.value.length ? [{ label: 'Scheduler', value: 'scheduler' }] : []),
])
const activeCalView = ref<'day' | 'week' | 'month' | 'list' | 'scheduler'>('week')

// Search slide-out for the bookings tab
const bookingsSearch = ref('')
const bookingsSearchOpen = ref(false)
const bookingsSearchInput = ref<any>(null)

// Booking hover popup
const bookingTooltip = reactive({
  visible: false,
  x: 0, y: 0,
  booking: null as any,
  dateLabel: '',
  timeLabel: '',
})
let bookingTooltipTimer: ReturnType<typeof setTimeout> | null = null

function onBookingHover(booking: any, ev: MouseEvent) {
  if (bookingTooltipTimer) clearTimeout(bookingTooltipTimer)
  const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  let x = rect.right + 10
  let y = rect.top
  if (x + 290 > window.innerWidth) x = rect.left - 300
  if (y + 220 > window.innerHeight) y = window.innerHeight - 230
  const start = booking.start_at ? new Date(booking.start_at) : null
  const end = booking.end_at ? new Date(booking.end_at) : null
  bookingTooltip.booking = {
    ...booking,
    _headerColor: booking.activity_mode?.color || (booking.type === 'EVENT_DRIVEN' ? '#1E2157' : '#3B82F6'),
  }
  bookingTooltip.dateLabel = start ? start.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  const fmtT = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  bookingTooltip.timeLabel = (start && end) ? `${fmtT(start)} – ${fmtT(end)}` : ''
  bookingTooltip.x = x
  bookingTooltip.y = y
  bookingTooltipTimer = setTimeout(() => { bookingTooltip.visible = true }, 200)
}

function hideBookingTooltip() {
  if (bookingTooltipTimer) clearTimeout(bookingTooltipTimer)
  bookingTooltip.visible = false
}

function onBookingsSearchBlur() {
  if (!bookingsSearch.value) bookingsSearchOpen.value = false
}

async function onBookingsSearchToggle() {
  if (bookingsSearchOpen.value && bookingsSearch.value) {
    bookingsSearch.value = ''
    return
  }
  bookingsSearchOpen.value = !bookingsSearchOpen.value
  if (bookingsSearchOpen.value) {
    await nextTick()
    const el = bookingsSearchInput.value?.$el
    if (el?.nodeName === 'INPUT') el.focus()
    else el?.querySelector('input')?.focus()
  }
}

const schedulerDate  = ref(new Date())
const schedulerTitle = computed(() =>
  schedulerDate.value.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long' })
)

function setCalView(view: string) {
  activeCalView.value = view as any
  if (view !== 'scheduler') calView.value = view as 'day' | 'week' | 'month' | 'list'
}

function navPrev() {
  if (activeCalView.value === 'scheduler') {
    const d = new Date(schedulerDate.value); d.setDate(d.getDate() - 1); schedulerDate.value = d; return
  }
  const d = new Date(calDate.value)
  if (calView.value === 'month' || calView.value === 'list') d.setMonth(d.getMonth() - 1)
  else if (calView.value === 'week') d.setDate(d.getDate() - 7)
  else d.setDate(d.getDate() - 1)
  calDate.value = d
}
function navNext() {
  if (activeCalView.value === 'scheduler') {
    const d = new Date(schedulerDate.value); d.setDate(d.getDate() + 1); schedulerDate.value = d; return
  }
  const d = new Date(calDate.value)
  if (calView.value === 'month' || calView.value === 'list') d.setMonth(d.getMonth() + 1)
  else if (calView.value === 'week') d.setDate(d.getDate() + 7)
  else d.setDate(d.getDate() + 1)
  calDate.value = d
}
function navToday() {
  if (activeCalView.value === 'scheduler') { schedulerDate.value = new Date(); return }
  calDate.value = new Date()
}

// Booking wizard
// ── New booking → full-page wizard ────────────────────────────
function openNewBooking(start?: Date | null, end?: Date | null, rule?: any) {
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const params = new URLSearchParams({ bookableId: id })
  if (start) {
    params.set('date', start.toISOString())
    params.set('startTime', fmt(start))
  }
  if (end) params.set('endTime', fmt(end))
  if (rule?.activity_mode_ids?.length) params.set('activityModeIds', rule.activity_mode_ids.join(','))
  navigateTo(`/bookings/new?${params}`)
}

function openSchedulerBooking(child: any, start: Date, end: Date) {
  const fmt = (d: Date) => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const params = new URLSearchParams({
    bookableId: child.id,
    date: start.toISOString(),
    startTime: fmt(start),
    endTime: fmt(end),
  })
  navigateTo(`/bookings/new?${params}`)
}

// ── Edit booking dialog ────────────────────────────────────────
const showEditDialog   = ref(false)
// Drawer width: false = compact 380px, true = expanded 720px (matches old modal).
const panelExpanded    = ref(false)
const editingBooking   = ref<any>(null)
const savingEdit       = ref(false)
const bookingTab       = ref<'details' | 'activity' | 'location' | 'notify'>('details')
const editForm         = reactive({
  status: '',
  start_at: null as Date | null,
  end_at: null as Date | null,
  notes: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  attendee_count: null as number | null,
  activity_id: null as string | null,
  activity_mode_id: null as string | null,
  bookable_id: null as string | null,
  custom_fields: {} as Record<string, any>,
})

const venueActivities    = ref<any[]>([])
const venueActivityModes = ref<any[]>([])
const allVenueBookables  = ref<any[]>([])

const bookingStatuses = [
  { label: 'Confirmed', value: 'CONFIRMED', color: '#10B981' },
  { label: 'Pending',   value: 'PENDING',   color: '#F59E0B' },
  { label: 'Cancelled', value: 'CANCELLED', color: '#9CA3AF' },
]

const bookingTabs = [
  { value: 'details',  label: 'Details',  icon: 'pi-info-circle' },
  { value: 'activity', label: 'Activity', icon: 'pi-bolt' },
  { value: 'location', label: 'Location', icon: 'pi-map-marker' },
  { value: 'notify',   label: 'Notify',   icon: 'pi-bell' },
]

const contactInitial = computed(() => {
  const n = (editForm.contact_name || '').trim()
  if (!n) return '?'
  const parts = n.split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase() || n[0].toUpperCase()
})

const modesForActivity = computed(() => {
  if (!editForm.activity_id) return []
  return venueActivityModes.value.filter((m: any) => m.activity_id === editForm.activity_id)
})

const moveTargets = computed(() =>
  allVenueBookables.value.filter((b: any) => b.id !== id),
)

// Placeholder until per-mode custom fields ship — kept around for legacy data shape.
const modeCustomFields = computed<{ id: string; label: string; placeholder?: string }[]>(() => {
  const mode = venueActivityModes.value.find((m: any) => m.id === editForm.activity_mode_id)
  return mode?.custom_fields ?? []
})

// Real form: when the selected activity mode has a form_id, fetch the form's
// fields + the col_span/core meta and render them in the drawer so staff can
// see (and edit) the answers the customer submitted.
const modeFormFields = ref<any[]>([])
const modeFormLoading = ref(false)
const CORE_BY_LABEL: Record<string, string> = {
  'First Name': 'first_name', 'Last Name': 'last_name', 'Email Address': 'email',
  'Phone Number': 'phone', 'People Attending': 'attendees', 'Notes': 'notes',
}
async function loadModeFormFields(formId: string | null) {
  modeFormFields.value = []
  if (!formId) return
  modeFormLoading.value = true
  try {
    const [{ data: ff }, { data: rf }] = await Promise.all([
      (db.from as any)('form_fields').select('*').eq('form_id', formId).order('sort_order'),
      (db.from as any)('registration_forms').select('config').eq('id', formId).maybeSingle(),
    ])
    const fieldMeta = (rf?.config as any)?.fieldMeta ?? {}
    modeFormFields.value = (ff ?? []).map((f: any) => {
      let opts: string[] = []
      try { opts = JSON.parse(f.options || '[]') } catch { opts = [] }
      const meta = fieldMeta[f.label] ?? {}
      return {
        ...f,
        _options: opts,
        _core: meta.core ?? CORE_BY_LABEL[f.label] ?? null,
        _col_span: meta.col_span ?? 2,
      }
    })
  } finally {
    modeFormLoading.value = false
  }
}
// Trigger a load whenever the active mode changes — including on drawer open.
watch(() => editForm.activity_mode_id, async (modeId) => {
  if (!modeId) { modeFormFields.value = []; return }
  const mode = venueActivityModes.value.find((m: any) => m.id === modeId)
  await loadModeFormFields(mode?.form_id ?? null)
}, { immediate: false })

// Payment + terms snapshot stored on the booking at submit time.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  invoice: 'Invoice', credit_card: 'Credit Card', payment_plan: 'Payment Plan', coupon: 'Coupon',
  // Legacy keys kept around in case older rows used them.
  card: 'Credit / Debit Card', bank: 'Bank Transfer', cash: 'Cash on the Day',
}
const bookingPaymentMethodLabel = computed(() => {
  const k = (editingBooking.value?.custom_fields as any)?._payment_method
  return k ? (PAYMENT_METHOD_LABELS[k] ?? k) : null
})
const bookingTermsAgreed = computed<{ label: string; agreed: boolean; at: string | null }[]>(() =>
  (editingBooking.value?.custom_fields as any)?._terms_agreed ?? [],
)

const editingBookingHeaderColor = computed(() => {
  const b = editingBooking.value
  if (!b) return '#1E2157'
  return b.activity_mode?.color || (b.type === 'EVENT_DRIVEN' ? '#1E2157' : '#3B82F6')
})
const editingBookingDateLabel = computed(() => {
  const d = editForm.start_at
  return d ? d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''
})
const editingBookingTimeLabel = computed(() => {
  const fmtT = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
  if (editForm.start_at && editForm.end_at) return `${fmtT(editForm.start_at)} – ${fmtT(editForm.end_at)}`
  return ''
})
const editingBookingStatusSeverity = computed(() => {
  const s = editForm.status
  if (s === 'CONFIRMED') return 'success'
  if (s === 'PENDING') return 'warn'
  if (s === 'CANCELLED') return 'danger'
  return 'secondary'
})

async function loadEditBookingOptions() {
  if (!orgId.value) return
  const [{ data: acts }, { data: modes }, { data: books }] = await Promise.all([
    (db.from as any)('activities').select('id, name, color').eq('org_id', orgId.value).eq('status', 'ACTIVE').order('name'),
    (db.from as any)('activity_modes').select('id, activity_id, name, color, form_id').order('name'),
    (db.from as any)('bookables').select('id, name, type').eq('org_id', orgId.value).neq('status', 'ARCHIVED').neq('status', 'DELETED').order('name'),
  ])
  venueActivities.value = acts ?? []
  venueActivityModes.value = modes ?? []
  allVenueBookables.value = books ?? []
}

function openEditBooking(booking: any) {
  editingBooking.value   = booking
  bookingTab.value       = 'details'
  editForm.status        = booking.status ?? 'CONFIRMED'
  editForm.start_at      = booking.start_at ? new Date(booking.start_at) : null
  editForm.end_at        = booking.end_at   ? new Date(booking.end_at)   : null
  editForm.notes         = booking.notes ?? ''
  editForm.contact_name  = booking.contact_name  ?? ''
  editForm.contact_email = booking.contact_email ?? ''
  editForm.contact_phone = booking.contact_phone ?? ''
  editForm.attendee_count = booking.attendee_count ?? null
  editForm.activity_id   = booking.activity_id ?? null
  editForm.activity_mode_id = booking.activity_mode_id ?? booking.activity_mode?.id ?? null
  editForm.bookable_id   = booking.bookable_id ?? id
  editForm.custom_fields = booking.custom_fields ?? {}
  // Wait for the modes list to load, then resolve the mode's form fields
  // explicitly (the watcher only fires on subsequent changes).
  loadEditBookingOptions().then(async () => {
    const mode = venueActivityModes.value.find((m: any) => m.id === editForm.activity_mode_id)
    await loadModeFormFields(mode?.form_id ?? null)
  })
  showEditDialog.value = true
}

async function saveEditBooking() {
  if (!editingBooking.value?.id) return
  savingEdit.value = true
  try {
    await db.from('bookings').update({
      status: editForm.status,
      start_at: editForm.start_at?.toISOString(),
      end_at: editForm.end_at?.toISOString(),
      notes: editForm.notes || null,
      contact_name:  editForm.contact_name  || null,
      contact_email: editForm.contact_email || null,
      contact_phone: editForm.contact_phone || null,
      attendee_count: editForm.attendee_count ?? null,
      activity_id: editForm.activity_id ?? null,
      activity_mode_id: editForm.activity_mode_id ?? null,
      bookable_id: editForm.bookable_id ?? id,
      custom_fields: editForm.custom_fields ?? {},
    }).eq('id', editingBooking.value.id)
    showEditDialog.value = false
    await loadBookings()
    toast.add({ severity: 'success', summary: 'Booking updated', life: 2000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Failed to update', detail: e?.message, life: 3000 })
  }
  savingEdit.value = false
}

async function approveBooking() {
  if (!editingBooking.value?.id) return
  savingEdit.value = true
  try {
    await db.from('bookings').update({ status: 'CONFIRMED' }).eq('id', editingBooking.value.id)
    editForm.status = 'CONFIRMED'
    if (editingBooking.value) editingBooking.value.status = 'CONFIRMED'
    const { data: n } = await (db.from as any)('notifications').insert({
      org_id: orgId.value,
      type: 'booking.approved',
      title: 'Booking approved',
      body: `${editForm.contact_name || 'Booking'} — ${editingBookingDateLabel.value}`,
      link: `/bookables/${id}?tab=bookings`,
      payload: { booking_id: editingBooking.value.id },
    }).select('id').single()
    if (n?.id) $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: n.id } }).catch(() => {})
    $fetch('/api/send-customer-booking-email', { method: 'POST', body: { bookingId: editingBooking.value.id, event: 'approved' } }).catch(() => {})
    await loadBookings()
    toast.add({ severity: 'success', summary: 'Booking approved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not approve', detail: e?.message, life: 4000 })
  }
  savingEdit.value = false
}

async function declineBooking() {
  if (!editingBooking.value?.id) return
  if (!confirm('Decline this booking? It will be cancelled and the slot freed up.')) return
  savingEdit.value = true
  try {
    await db.from('bookings').update({ status: 'CANCELLED' }).eq('id', editingBooking.value.id)
    editForm.status = 'CANCELLED'
    if (editingBooking.value) editingBooking.value.status = 'CANCELLED'
    const { data: n } = await (db.from as any)('notifications').insert({
      org_id: orgId.value,
      type: 'booking.declined',
      title: 'Booking declined',
      body: `${editForm.contact_name || 'Booking'} — ${editingBookingDateLabel.value}`,
      link: `/bookables/${id}?tab=bookings`,
      payload: { booking_id: editingBooking.value.id },
    }).select('id').single()
    if (n?.id) $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: n.id } }).catch(() => {})
    $fetch('/api/send-customer-booking-email', { method: 'POST', body: { bookingId: editingBooking.value.id, event: 'declined' } }).catch(() => {})
    showEditDialog.value = false
    await loadBookings()
    toast.add({ severity: 'success', summary: 'Booking declined', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not decline', detail: e?.message, life: 4000 })
  }
  savingEdit.value = false
}

async function deleteBooking() {
  if (!editingBooking.value?.id) return
  if (!confirm('Delete this booking?')) return
  await db.from('bookings').delete().eq('id', editingBooking.value.id)
  showEditDialog.value = false
  await loadBookings()
  toast.add({ severity: 'success', summary: 'Booking deleted', life: 2000 })
}

function notifyEmail() {
  if (!editForm.contact_email) {
    toast.add({ severity: 'warn', summary: 'No email on file', life: 3000 })
    return
  }
  toast.add({ severity: 'info', summary: 'Email queued', detail: `Would send to ${editForm.contact_email}`, life: 3500 })
}

function notifyApp() {
  toast.add({ severity: 'info', summary: 'In-app notification queued', life: 3000 })
}

const tabs = computed(() => [
  { key: 'bookings',   label: 'Bookings',    icon: 'pi-calendar' },
  { key: 'details',    label: 'Details',     icon: 'pi-info-circle' },
  { key: 'availability', label: 'Availability', icon: 'pi-clock' },
  ...(venue.value?.allow_multiple_layouts !== false ? [{ key: 'layouts', label: 'Layouts', icon: 'pi-th-large' }] : []),
  ...(venue.value?.allow_sub_venues ? [{ key: 'sub-venues', label: 'Sub-venues', icon: 'pi-sitemap' }] : []),
  { key: 'items',      label: 'Items',       icon: 'pi-box' },
])



const moreMenuItems = computed(() => [
  {
    label: 'Add Sub-venue',
    icon: 'pi pi-sitemap',
    command: () => createChildBookable('VENUE')
  },
  { separator: true },
  {
    label: 'Archive',
    icon: 'pi pi-trash',
    class: 'text-red-500',
    command: async () => {
      if (!confirm(`Archive "${venue.value?.name}"?`)) return
      await db.from('bookables').update({ status: 'ARCHIVED' }).eq('id', id)
      toast.add({ severity: 'success', summary: 'Archived', life: 3000 })
      navigateTo('/bookables')
    }
  },
])

function statusSeverity(s: string) {
  return { ACTIVE: 'success', DRAFT: 'secondary', ARCHIVED: 'warn', DELETED: 'danger' }[s] ?? 'secondary'
}
function bookingStatusSeverity(s: string) {
  return { CONFIRMED: 'success', PENDING: 'warn', CANCELLED: 'danger' }[s] ?? 'secondary'
}

function formatDT(d: string) {
  return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function onScheduleSaved() {
  if (venue.value?.is_master) {
    const targets = linkedItems.value.filter(l => !(l.customized_sections ?? []).includes('schedule')).map(l => l.id)
    if (targets.length) {
      await propagateSection('schedule', targets)
      toast.add({ severity: 'info', summary: `Schedule synced to ${targets.length} linked venue${targets.length !== 1 ? 's' : ''}`, life: 2500 })
    }
  }
}

async function onSaved(saved: any) {
  venue.value = saved
  toast.add({ severity: 'success', summary: 'Saved', life: 2000 })
  if (saved.default_booking_view) {
    const VIEW_MAP: Record<string, string> = {
      dayGridMonth: 'month', timeGridWeek: 'week', timeGridDay: 'day', listWeek: 'list',
      month: 'month', week: 'week', day: 'day', list: 'list',
    }
    const mapped = VIEW_MAP[saved.default_booking_view] ?? 'week'
    if (mapped !== activeCalView.value) setCalView(mapped)
  }
  if (saved.is_master && activeTab.value === 'layouts') {
    const targets = linkedItems.value.filter(l => !(l.customized_sections ?? []).includes('layouts')).map(l => l.id)
    if (targets.length) {
      await propagateSection('layouts', targets)
      toast.add({ severity: 'info', summary: `Layouts synced to ${targets.length} linked venue${targets.length !== 1 ? 's' : ''}`, life: 2500 })
    }
  }
}

async function onDelete() {
  if (!confirm(`Delete "${venue.value?.name}"? This cannot be undone.`)) return
  await db.from('bookables').update({ status: 'DELETED' }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Deleted', life: 2000 })
  navigateTo('/bookables')
}

async function loadVenue() {
  loading.value = true
  const [{ data }, { data: all }] = await Promise.all([
    db.from('bookables').select('*').eq('id', id).maybeSingle(),
    db.from('bookables').select('id, name, type').eq('org_id', orgId.value).neq('status', 'DELETED').order('name'),
  ])
  venue.value = data
  allBookables.value = all ?? []
  if (data?.parent_id) {
    const { data: parent } = await db.from('bookables').select('id, name').eq('id', data.parent_id).maybeSingle()
    parentVenue.value = parent
  } else {
    parentVenue.value = null
  }
  if (data?.default_booking_view) {
    const VIEW_MAP: Record<string, 'day' | 'week' | 'month' | 'list'> = {
      dayGridMonth: 'month', timeGridWeek: 'week', timeGridDay: 'day', listWeek: 'list',
      month: 'month', week: 'week', day: 'day', list: 'list',
    }
    const mapped = VIEW_MAP[data.default_booking_view] ?? 'week'
    calView.value = mapped
    activeCalView.value = mapped
  }
  // Set breadcrumbs in global header
  const crumbs: { label: string; to?: string }[] = [{ label: 'Bookables', to: '/bookables' }]
  if (parentVenue.value) crumbs.push({ label: parentVenue.value.name, to: `/bookables/${parentVenue.value.id}` })
  crumbs.push({ label: data?.name ?? 'Venue' })
  breadcrumbs.value = crumbs
  loading.value = false
}

async function loadLinked() {
  const { data } = await db.from('bookables').select('*').eq('master_id', id).neq('status', 'DELETED').order('name')
  linkedItems.value = data ?? []
}

async function syncToLinked() {
  if (!linkedItems.value.length || !venue.value) return
  syncing.value = true
  const master = venue.value
  // Copy bookable fields
  await db.from('bookables').update({
    description: master.description,
    rules: master.rules,
    features: master.features,
    sports: master.sports,
    max_concurrent: master.max_concurrent,
  }).in('id', linkedItems.value.map(l => l.id))
  const { data: masterLayouts } = await (db.from as any)('bookable_layouts').select('*').eq('bookable_id', id)
  for (const linked of linkedItems.value) {
    const lid = linked.id
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', lid)
    if (masterLayouts?.length) {
      await (db.from as any)('bookable_layouts')
        .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, ...rest }: any) => ({ ...rest, bookable_id: lid })))
    }
  }
  syncing.value = false
  toast.add({ severity: 'success', summary: `Synced to ${linkedItems.value.length} linked item(s)`, life: 3000 })
}

async function syncFromMaster() {
  if (!venue.value?.master_id) return
  syncing.value = true
  const masterId = venue.value.master_id
  const { data: master } = await db.from('bookables').select('*').eq('id', masterId).single()
  if (master) {
    await db.from('bookables').update({
      description: master.description,
      rules: master.rules,
      features: master.features,
      sports: master.sports,
      max_concurrent: master.max_concurrent,
    }).eq('id', id)
    const { data: masterLayouts } = await (db.from as any)('bookable_layouts').select('*').eq('bookable_id', masterId)
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', id)
    if (masterLayouts?.length) {
      await (db.from as any)('bookable_layouts')
        .insert(masterLayouts.map(({ id: _, bookable_id: __, created_at: ___, ...rest }: any) => ({ ...rest, bookable_id: id })))
    }
    await loadVenue()
    await afterPricingMutation()
  }
  syncing.value = false
  toast.add({ severity: 'success', summary: 'Synced from master', life: 3000 })
}

async function loadChildren() {
  const { data } = await db.from('bookables').select('*').eq('parent_id', id).eq('type', 'VENUE').neq('status', 'DELETED').order('name')
  children.value = data ?? []
}

async function duplicateVenue(child: any) {
  const { id: _, created_at: __, ...rest } = child
  const { data } = await db.from('bookables').insert({ ...rest, name: `${child.name} (copy)` }).select('id').single()
  if (data?.id) {
    await loadChildren()
    toast.add({ severity: 'success', summary: 'Duplicated', detail: `"${child.name} (copy)" created`, life: 2500 })
  }
}

async function loadItems() {
  const { data } = await db.from('bookables').select('*').eq('parent_id', id).eq('type', 'ITEM').neq('status', 'DELETED').order('sort_order').order('name')
  items.value = data ?? []
}

function loadBookings() {
  bookingsRefreshKey.value++
}

watch(activeTab, tab => {
  router.replace({ query: { ...route.query, tab } })
  if (tab === 'items') loadItems()
})

onMounted(async () => {
  // Wait for orgId to be resolved before loading (avoids stale null on hard refresh)
  if (!orgReady.value) {
    await Promise.race([
      new Promise<void>(resolve => {
        const stop = watch(orgReady, ready => { if (ready) { stop(); resolve() } })
      }),
      new Promise<void>(resolve => setTimeout(resolve, 3000)),
    ])
  }
  await loadVenue()
  await loadChildren()
  loadItems()
  loadLinked()

  // If we landed here from /bookings/pending (or similar) with ?booking=<id>,
  // fetch that booking and pop the edit modal automatically.
  const bookingId = route.query.booking as string | undefined
  if (bookingId) {
    const { data } = await (db.from as any)('bookings')
      .select(`
        id, status, start_at, end_at, contact_name, contact_email, contact_phone,
        attendee_count, notes, custom_fields, bookable_id, activity_id, activity_mode_id, type,
        event:events(id, title),
        activity_mode:activity_modes(id, name, color),
        bookable:bookables(id, name, location)
      `)
      .eq('id', bookingId)
      .maybeSingle()
    if (data) openEditBooking(data)
  }
})

onUnmounted(() => { breadcrumbs.value = [] })
</script>

<style scoped>
.slide-search-enter-active,
.slide-search-leave-active {
  transition: max-width 0.2s ease, opacity 0.15s ease, margin-right 0.2s ease;
  overflow: hidden;
  max-width: 280px;
}
.slide-search-enter-from,
.slide-search-leave-to {
  max-width: 0;
  opacity: 0;
  margin-right: 0 !important;
}
</style>
