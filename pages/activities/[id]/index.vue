<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <i class="pi pi-spin pi-spinner text-xl" />
    </div>

    <template v-else-if="activity">

      <!-- Header bar -->
      <div class="bg-white border-b border-gray-200 px-4 py-2 shrink-0 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mr-1"
            @click="navigateTo('/bookables?tab=activities')">
            <i class="pi pi-chevron-left text-xs" />
            <span class="hidden sm:inline">Activities</span>
          </button>
          <span class="text-gray-300">/</span>
          <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            :style="{ background: form.color + '22', color: form.color }">
            <i :class="`pi ${form.icon} text-xs`" />
          </div>
          <span class="text-sm font-semibold text-gray-800">{{ activity.name }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Button label="Save" icon="pi pi-check" size="small" :loading="saving"
            @click="save" style="background:#1E2157;border-color:#1E2157" />
          <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small"
            @click="e => actionsMenu.toggle(e)" />
          <Menu ref="actionsMenu" :model="actionsMenuItems" :popup="true" />
        </div>
      </div>

      <!-- Two-column body -->
      <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
        <div class="p-6 flex gap-5 items-start">

          <!-- ── Left: Details + Booking settings + Venues + Booking link + Groups ── -->
          <div class="w-1/2 space-y-5">

            <!-- Details card -->
            <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              <div class="flex items-center px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Name</span>
                <InputText v-model="form.name" placeholder="e.g. Tennis" class="flex-1" />
              </div>
              <div class="flex items-start px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0 pt-1">Description</span>
                <Textarea v-model="form.description" placeholder="Optional" auto-resize rows="2" class="flex-1 text-sm" />
              </div>
              <div class="flex items-center px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Colour</span>
                <div class="flex gap-2.5 flex-wrap">
                  <button v-for="c in COLORS" :key="c" type="button"
                    class="w-6 h-6 rounded-full ring-offset-2 transition-all"
                    :style="{ background: c }"
                    :class="form.color === c ? 'ring-2 ring-gray-700' : 'hover:ring-2 hover:ring-gray-300'"
                    @click="form.color = c" />
                </div>
              </div>
              <div class="flex items-center px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Status</span>
                <Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value"
                  size="small" class="w-40" />
              </div>
              <div class="flex items-center px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Bookings enabled</span>
                <ToggleSwitch v-model="form.bookings_enabled" />
                <span class="text-xs text-gray-400">{{ form.bookings_enabled ? 'Open' : 'Closed' }}</span>
              </div>
              <div class="flex items-center px-5 py-4 gap-3">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Area name</span>
                <div class="flex items-center gap-2 flex-1">
                  <InputText v-model="form.area_name_singular" placeholder="Singular" class="flex-1" />
                  <span class="text-xs text-gray-400 shrink-0">/</span>
                  <InputText v-model="form.area_name_plural" placeholder="Plural" class="flex-1" />
                </div>
              </div>
              <div class="flex items-start px-5 py-4 gap-6">
                <span class="text-sm font-semibold text-gray-700 w-32 shrink-0 pt-1">Image</span>
                <div class="flex-1">
                  <div v-if="!form.image_url"
                    class="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-[#1E2157] transition-colors cursor-pointer"
                    @click="imageInput?.click()">
                    <i class="pi pi-image text-2xl text-gray-300" />
                    <Button label="Upload image" severity="secondary" outlined size="small" icon="pi pi-upload" />
                  </div>
                  <div v-else class="relative rounded-xl overflow-hidden w-48">
                    <img :src="form.image_url" class="w-full h-32 object-cover" />
                    <div v-if="uploadingImage" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <i class="pi pi-spin pi-spinner text-white text-xl" />
                    </div>
                    <Button v-else icon="pi pi-times" severity="danger" rounded size="small"
                      class="absolute top-2 right-2" @click="form.image_url = ''" />
                  </div>
                  <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
                </div>
              </div>
            </div>

            <!-- Booking settings card -->
            <AppCard title="Booking settings" description="Rules applied when someone makes a booking for this activity">
              <div class="grid grid-cols-2 divide-x divide-gray-100">

                <!-- Timing -->
                <div class="divide-y divide-gray-100">
                  <div class="px-5 py-2.5 bg-gray-50/60">
                    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Timing</p>
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Booking flow</p>
                      <p class="text-xs text-gray-400">{{ form.booking_flow === 'scheduler' ? 'Scheduler grid: pick venue → click slot → mode → details' : 'Guided wizard: activity → mode → resource → date → details' }}</p>
                    </div>
                    <div class="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium shrink-0">
                      <button type="button" class="px-3 py-1.5 transition-colors"
                        :class="form.booking_flow === 'wizard' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        @click="form.booking_flow = 'wizard'">Wizard</button>
                      <button type="button" class="px-3 py-1.5 border-l border-gray-200 transition-colors"
                        :class="form.booking_flow === 'scheduler' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        @click="form.booking_flow = 'scheduler'">Scheduler</button>
                    </div>
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Approval</p>
                      <p class="text-xs text-gray-400">Who confirms bookings</p>
                    </div>
                    <div class="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium shrink-0">
                      <button type="button" class="px-3 py-1.5 transition-colors"
                        :class="form.approval_mode === 'auto' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        @click="form.approval_mode = 'auto'">Auto</button>
                      <button type="button" class="px-3 py-1.5 border-l border-gray-200 transition-colors"
                        :class="form.approval_mode === 'manual' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        @click="form.approval_mode = 'manual'">Manual</button>
                    </div>
                  </div>
                  <div class="flex items-start justify-between px-5 py-3 gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Advance window</p>
                      <div v-if="form.booking_window_days !== null" class="flex items-center gap-1.5 mt-1">
                        <InputNumber v-model="bookingWindowDisplay" :min="1" :max="730" class="w-16"
                          @update:modelValue="v => form.booking_window_days = windowDisplayToDays(v, bookingWindowUnit)" />
                        <select :value="bookingWindowUnit"
                          style="border:none;background:white;font-size:0.75rem;color:#6b7280;cursor:pointer;outline:none;-webkit-appearance:auto;appearance:auto;"
                          @change="onBookingWindowUnitChange">
                          <option value="days">days</option>
                          <option value="weeks">weeks</option>
                          <option value="months">months</option>
                        </select>
                      </div>
                      <p v-else class="text-xs text-gray-400">How far ahead</p>
                    </div>
                    <ToggleSwitch :modelValue="form.booking_window_days !== null" class="mt-0.5 shrink-0"
                      @update:modelValue="v => { form.booking_window_days = v ? 30 : null; bookingWindowDisplay = v ? 30 : null; bookingWindowUnit = 'days' }" />
                  </div>
                  <div class="flex items-start justify-between px-5 py-3 gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Min notice</p>
                      <div v-if="form.min_notice_hours !== null" class="flex items-center gap-1.5 mt-1">
                        <InputNumber v-model="minNoticeDisplay" :min="1" :max="720" class="w-16"
                          @update:modelValue="v => form.min_notice_hours = displayToHours(v, minNoticeUnit)" />
                        <select :value="minNoticeUnit"
                          style="border:none;background:white;font-size:0.75rem;color:#6b7280;cursor:pointer;outline:none;-webkit-appearance:auto;appearance:auto;"
                          @change="onMinNoticeUnitChange">
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </select>
                      </div>
                      <p v-else class="text-xs text-gray-400">Before start time</p>
                    </div>
                    <ToggleSwitch :modelValue="form.min_notice_hours !== null" class="mt-0.5 shrink-0"
                      @update:modelValue="v => { form.min_notice_hours = v ? 2 : null; minNoticeDisplay = v ? 2 : null; minNoticeUnit = 'hours' }" />
                  </div>
                  <div class="flex items-start justify-between px-5 py-3 gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Cancellation</p>
                      <div v-if="form.cancellation_window_hours !== null" class="flex items-center gap-1.5 mt-1">
                        <InputNumber v-model="cancellationDisplay" :min="1" :max="720" class="w-16"
                          @update:modelValue="v => form.cancellation_window_hours = displayToHours(v, cancellationUnit)" />
                        <select :value="cancellationUnit"
                          style="border:none;background:white;font-size:0.75rem;color:#6b7280;cursor:pointer;outline:none;-webkit-appearance:auto;appearance:auto;"
                          @change="onCancellationUnitChange">
                          <option value="hours">hours</option>
                          <option value="days">days</option>
                        </select>
                      </div>
                      <p v-else class="text-xs text-gray-400">Latest to cancel</p>
                    </div>
                    <ToggleSwitch :modelValue="form.cancellation_window_hours !== null" class="mt-0.5 shrink-0"
                      @update:modelValue="v => { form.cancellation_window_hours = v ? 24 : null; cancellationDisplay = v ? 24 : null; cancellationUnit = 'hours' }" />
                  </div>
                  <div class="flex items-start justify-between px-5 py-3 gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Min duration</p>
                      <div v-if="form.min_duration_mins !== null" class="flex items-center gap-1.5 mt-1">
                        <InputNumber v-model="form.min_duration_mins" :min="5" :max="1440" :step="5" class="w-16" />
                        <span class="text-xs text-gray-500">mins</span>
                      </div>
                      <p v-else class="text-xs text-gray-400">Shortest booking</p>
                    </div>
                    <ToggleSwitch :modelValue="form.min_duration_mins !== null" class="mt-0.5 shrink-0"
                      @update:modelValue="v => form.min_duration_mins = v ? 30 : null" />
                  </div>
                  <div class="flex items-start justify-between px-5 py-3 gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Max duration</p>
                      <div v-if="form.max_duration_mins !== null" class="flex items-center gap-1.5 mt-1">
                        <InputNumber v-model="form.max_duration_mins" :min="5" :max="1440" :step="5" class="w-16" />
                        <span class="text-xs text-gray-500">mins</span>
                      </div>
                      <p v-else class="text-xs text-gray-400">Longest booking</p>
                    </div>
                    <ToggleSwitch :modelValue="form.max_duration_mins !== null" class="mt-0.5 shrink-0"
                      @update:modelValue="v => form.max_duration_mins = v ? 120 : null" />
                  </div>
                  <div class="flex items-start justify-between px-5 py-3 gap-3">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-700">Buffer time</p>
                      <div v-if="form.buffer_mins !== null" class="flex items-center gap-1.5 mt-1">
                        <InputNumber v-model="form.buffer_mins" :min="5" :max="240" :step="5" class="w-16" />
                        <span class="text-xs text-gray-500">mins</span>
                      </div>
                      <p v-else class="text-xs text-gray-400">Gap between bookings</p>
                    </div>
                    <ToggleSwitch :modelValue="form.buffer_mins !== null" class="mt-0.5 shrink-0"
                      @update:modelValue="v => form.buffer_mins = v ? 15 : null" />
                  </div>
                </div>

                <!-- Behaviour -->
                <div class="divide-y divide-gray-100">
                  <div class="px-5 py-2.5 bg-gray-50/60">
                    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Behaviour</p>
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Multi-slot booking</p>
                      <p class="text-xs text-gray-400">Select multiple slots at once</p>
                    </div>
                    <ToggleSwitch v-model="form.allow_multi_slot" />
                  </div>
                  <div v-if="form.allow_multi_slot" class="flex items-center justify-between px-5 py-3 gap-3 bg-gray-50/50">
                    <div class="pl-3">
                      <p class="text-sm font-medium text-gray-700">During peak hours</p>
                      <p class="text-xs text-gray-400">Also allow in peak windows</p>
                    </div>
                    <ToggleSwitch v-model="form.allow_multi_slot_peak" />
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Kiosk mode</p>
                      <p class="text-xs text-gray-400">Allow via a shared kiosk</p>
                    </div>
                    <ToggleSwitch v-model="form.allow_kiosk" />
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Recurring bookings</p>
                      <p class="text-xs text-gray-400">Allow repeating bookings</p>
                    </div>
                    <ToggleSwitch v-model="form.allow_recurring" />
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Members can edit</p>
                      <p class="text-xs text-gray-400">Change their own bookings</p>
                    </div>
                    <ToggleSwitch v-model="form.allow_member_changes" />
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Auto-remove unpaid</p>
                      <p class="text-xs text-gray-400">Remove unpaid bookings</p>
                    </div>
                    <ToggleSwitch v-model="form.auto_remove_unpaid" />
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Require visitor names</p>
                      <p class="text-xs text-gray-400">Collect names for visitors</p>
                    </div>
                    <ToggleSwitch v-model="form.require_visitor_names" />
                  </div>
                  <div class="flex items-center justify-between px-5 py-3 gap-3">
                    <div>
                      <p class="text-sm font-medium text-gray-700">Hide member names</p>
                      <p class="text-xs text-gray-400">Hide from other bookers</p>
                    </div>
                    <ToggleSwitch v-model="form.hide_member_names" />
                  </div>
                </div>

              </div>
            </AppCard>

            <!-- Venues -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Venues</p>
                  <p class="text-xs text-gray-400 mt-0.5">Where this activity takes place</p>
                </div>
                <MultiSelect v-model="linkedBookableIds" :options="allBookables" option-label="name" option-value="id"
                  placeholder="Add…" size="small" class="w-36"
                  @update:modelValue="saveVenueLinks" />
              </div>
              <div v-if="!linkedBookables.length" class="px-5 py-6 text-center text-sm text-gray-400">No venues linked</div>
              <div v-else class="divide-y divide-gray-50">
                <div v-for="b in linkedBookables" :key="b.id" class="px-4 py-3 flex items-center gap-3">
                  <img v-if="b.main_image || b.sponsor_image"
                    :src="b.main_image || b.sponsor_image" class="w-7 h-7 rounded-lg object-cover shrink-0" />
                  <div v-else class="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                    <i class="pi pi-building text-gray-300 text-xs" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-800 truncate">{{ b.name }}</p>
                  </div>
                  <button type="button" class="text-gray-300 hover:text-red-400 transition-colors" @click="unlinkVenue(b.id)">
                    <i class="pi pi-times text-xs" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Booking link -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100">
                <p class="text-sm font-semibold text-gray-800">Booking link</p>
              </div>
              <div class="px-4 py-3 flex items-center gap-2">
                <code class="flex-1 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 truncate select-all font-mono">{{ bookingLink }}</code>
                <button type="button"
                  class="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  :class="linkCopied ? 'text-green-600 border-green-200 bg-green-50' : 'text-gray-600'"
                  @click="copyBookingLink">
                  <i :class="`pi ${linkCopied ? 'pi-check' : 'pi-copy'} text-xs`" />
                </button>
                <NuxtLink :to="`/bookings/new?activityId=${activity.id}`"
                  class="shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-[#1E2157] text-white hover:bg-[#2a2f6e] transition-colors">
                  <i class="pi pi-external-link text-xs" />
                </NuxtLink>
              </div>
            </div>

            <!-- Groups -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p class="text-sm font-semibold text-gray-800">Groups</p>
                  <p class="text-xs text-gray-400 mt-0.5">Who has access</p>
                </div>
                <MultiSelect v-model="linkedGroupIds" :options="allGroups" option-label="name" option-value="id"
                  placeholder="Add…" size="small" class="w-36"
                  @update:modelValue="saveGroupLinks" />
              </div>
              <div v-if="!linkedGroups.length" class="px-5 py-6 text-center text-sm text-gray-400">No groups linked</div>
              <div v-else class="divide-y divide-gray-50">
                <div v-for="g in linkedGroups" :key="g.id" class="px-4 py-3 flex items-center gap-3">
                  <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: g.color ?? '#94a3b8' }" />
                  <span class="flex-1 text-sm font-medium text-gray-800 truncate">{{ g.name }}</span>
                  <button type="button" class="text-gray-300 hover:text-red-400 transition-colors" @click="unlinkGroup(g.id)">
                    <i class="pi pi-times text-xs" />
                  </button>
                </div>
              </div>
            </div>

          </div><!-- end left column -->

          <!-- ── Right: Modes ── -->
          <div class="w-1/2 space-y-5">

            <!-- Modes panel -->
            <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100">
                <div class="flex items-center justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-gray-800">{{ form.mode_label || 'Modes' }}</p>
                    <p class="text-xs text-gray-400 mt-0.5">Sub-types for this activity, e.g. "Boys Birthday"</p>
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer shrink-0">
                    <span class="text-xs text-gray-500">Require {{ (form.mode_label || 'mode').toLowerCase() }}</span>
                    <ToggleSwitch v-model="form.require_mode" @change="save" />
                  </label>
                  <Button label="Add" icon="pi pi-plus" size="small" severity="secondary" outlined
                    @click="navigateTo(`/activities/${route.params.id}/modes/new`)" />
                </div>
                <!-- Booker-facing display options. These flow through to
                     the wizard's Mode step + BookingScheduler labels. -->
                <div class="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="text-[11px] text-gray-500 shrink-0">Booker label</span>
                    <input v-model="form.mode_label" type="text" placeholder="Mode" maxlength="32"
                      class="h-7 px-2 text-xs border border-gray-200 rounded outline-none focus:border-[#1E2157] focus:ring-2 focus:ring-[#1E2157]/15 w-40 transition-shadow"
                      @change="save" />
                    <span class="text-[11px] text-gray-400 shrink-0 hidden sm:inline">e.g. Format, Theme, Style</span>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[11px] text-gray-500">Display</span>
                    <div class="flex border border-gray-200 rounded-lg overflow-hidden">
                      <button type="button"
                        class="w-8 h-7 flex items-center justify-center transition-colors"
                        :class="form.mode_display === 'list' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        title="List — image on left"
                        @click="form.mode_display = 'list'; save()">
                        <i class="pi pi-list text-xs" />
                      </button>
                      <button type="button"
                        class="w-8 h-7 flex items-center justify-center border-l border-gray-200 transition-colors"
                        :class="form.mode_display === 'grid' ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                        title="Grid — image on top"
                        @click="form.mode_display = 'grid'; save()">
                        <i class="pi pi-th-large text-xs" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th class="px-4 py-2.5 text-left w-10"></th>
                    <th class="px-4 py-2.5 text-left">Name</th>
                    <th class="px-4 py-2.5 text-left">Description</th>
                    <th class="px-4 py-2.5 text-left w-16">Colour</th>
                    <th class="px-4 py-2.5 w-16"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  <tr v-if="!modes.length">
                    <td colspan="5" class="px-5 py-10 text-center text-sm text-gray-400">
                      No modes yet — add one to let bookers choose a sub-type
                    </td>
                  </tr>
                  <tr v-for="mode in modes" :key="mode.id" class="hover:bg-gray-50 group cursor-pointer"
                    @click="navigateTo(`/activities/${route.params.id}/modes/${mode.id}`)">
                    <td class="px-4 py-3">
                      <img v-if="mode.image_url" :src="mode.image_url"
                        class="w-8 h-8 rounded-lg object-cover border border-gray-100" />
                      <span v-else class="w-3 h-3 rounded-full block" :style="{ background: mode.color || '#6366F1' }" />
                    </td>
                    <td class="px-4 py-3 font-medium text-gray-800">{{ mode.name }}</td>
                    <td class="px-4 py-3 text-gray-400 text-xs">{{ mode.description ?? '—' }}</td>
                    <td class="px-4 py-3">
                      <span class="w-4 h-4 rounded-full block" :style="{ background: mode.color || '#6366F1' }" />
                    </td>
                    <td class="px-4 py-3" @click.stop>
                      <div class="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" class="text-xs text-gray-400 hover:text-gray-700"
                          @click="navigateTo(`/activities/${route.params.id}/modes/${mode.id}`)">Edit</button>
                        <button type="button" class="text-xs text-gray-400 hover:text-gray-700"
                          :disabled="cloningModeId === mode.id"
                          @click="cloneMode(mode)">
                          <span v-if="cloningModeId === mode.id">…</span>
                          <span v-else>Clone</span>
                        </button>
                        <button type="button" class="text-gray-300 hover:text-red-400"
                          @click="deleteMode(mode.id)">
                          <i class="pi pi-times text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div><!-- end right column -->

        </div><!-- end two-column body -->
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const route = useRoute()
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

const actionsMenu = ref()
const actionsMenuItems = computed(() => [
  { label: 'Delete activity', icon: 'pi pi-trash', command: deleteActivity },
])

const bookingLink = computed(() => {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/bookings/new?activityId=${route.params.id}`
})
const linkCopied = ref(false)
async function copyBookingLink() {
  await navigator.clipboard.writeText(bookingLink.value)
  linkCopied.value = true
  setTimeout(() => { linkCopied.value = false }, 2000)
}

const COLORS = ['#6366F1','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#84CC16']

const statusOptions = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Archived', value: 'ARCHIVED' },
]

const activity = ref<any>(null)
const loading = ref(true)
const saving = ref(false)
const modes = ref<any[]>([])

const allBookables = ref<any[]>([])
const linkedBookableIds = ref<string[]>([])
const linkedBookables = computed(() => allBookables.value.filter(b => linkedBookableIds.value.includes(b.id)))

const allGroups = ref<any[]>([])
const linkedGroupIds = ref<string[]>([])
const linkedGroups = computed(() => allGroups.value.filter(g => linkedGroupIds.value.includes(g.id)))

const form = reactive({
  name: '',
  description: '',
  image_url: '',
  color: COLORS[0],
  icon: 'pi-bolt',
  status: 'ACTIVE',
  require_mode: false,
  area_name_singular: '',
  area_name_plural: '',
  bookings_enabled: true,
  allow_multi_slot: false,
  allow_multi_slot_peak: false,
  allow_kiosk: false,
  allow_recurring: false,
  allow_member_changes: false,
  auto_remove_unpaid: false,
  require_visitor_names: false,
  hide_member_names: false,
  approval_mode: 'auto' as 'auto' | 'manual',
  booking_flow: 'wizard' as 'wizard' | 'scheduler',
  mode_label: 'Mode',
  mode_display: 'grid' as 'grid' | 'list',
  booking_window_days: null as number | null,
  min_notice_hours: null as number | null,
  cancellation_window_hours: null as number | null,
  min_duration_mins: null as number | null,
  max_duration_mins: null as number | null,
  buffer_mins: null as number | null,
})

const imageInput = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const { uploadFile } = useUpload()

async function handleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  form.image_url = URL.createObjectURL(file)
  uploadingImage.value = true
  try { form.image_url = await uploadFile(file) } finally { uploadingImage.value = false }
}

const bookingWindowUnit = ref<'days' | 'weeks' | 'months'>('days')
const minNoticeUnit = ref<'hours' | 'days'>('hours')
const cancellationUnit = ref<'hours' | 'days'>('hours')
const bookingWindowDisplay = ref<number | null>(null)
const minNoticeDisplay = ref<number | null>(null)
const cancellationDisplay = ref<number | null>(null)

function windowDisplayToDays(val: number | null, unit: 'days' | 'weeks' | 'months'): number | null {
  if (val === null) return null
  if (unit === 'weeks') return val * 7
  if (unit === 'months') return val * 30
  return val
}
function displayToHours(val: number | null, unit: 'hours' | 'days'): number | null {
  if (val === null) return null
  return unit === 'days' ? val * 24 : val
}
function inferWindowUnit(days: number | null): 'days' | 'weeks' | 'months' {
  if (!days) return 'days'
  if (days % 30 === 0) return 'months'
  if (days % 7 === 0) return 'weeks'
  return 'days'
}
function inferHoursUnit(hours: number | null): 'hours' | 'days' {
  if (!hours) return 'hours'
  return hours % 24 === 0 ? 'days' : 'hours'
}
function daysToDisplay(days: number | null, unit: 'days' | 'weeks' | 'months'): number | null {
  if (days === null) return null
  if (unit === 'weeks') return Math.round(days / 7)
  if (unit === 'months') return Math.round(days / 30)
  return days
}
function hoursToDisplay(hours: number | null, unit: 'hours' | 'days'): number | null {
  if (hours === null) return null
  return unit === 'days' ? Math.round(hours / 24) : hours
}

function onBookingWindowUnitChange(e: Event) {
  const unit = (e.target as HTMLSelectElement).value as 'days' | 'weeks' | 'months'
  bookingWindowUnit.value = unit
  form.booking_window_days = windowDisplayToDays(bookingWindowDisplay.value, unit)
}
function onMinNoticeUnitChange(e: Event) {
  const unit = (e.target as HTMLSelectElement).value as 'hours' | 'days'
  minNoticeUnit.value = unit
  form.min_notice_hours = displayToHours(minNoticeDisplay.value, unit)
}
function onCancellationUnitChange(e: Event) {
  const unit = (e.target as HTMLSelectElement).value as 'hours' | 'days'
  cancellationUnit.value = unit
  form.cancellation_window_hours = displayToHours(cancellationDisplay.value, unit)
}

useBreadcrumbs([
  { label: 'Activities', to: '/activities' },
  { label: computed(() => activity.value?.name ?? '…') },
])

async function load() {
  loading.value = true
  try {
    const [{ data: act }, { data: bookables }, { data: venueLinks }, { data: groups }, { data: groupLinks }, { data: modeData }] = await Promise.all([
      (db.from as any)('activities').select('*').eq('id', route.params.id).single(),
      (db.from as any)('bookables').select('id, name, location, main_image, sponsor_image')
        .eq('org_id', orgId.value).neq('status', 'DELETED').order('name'),
      (db.from as any)('activity_bookables').select('bookable_id').eq('activity_id', route.params.id),
      (db.from as any)('member_groups').select('id, name, color').eq('org_id', orgId.value).order('name'),
      (db.from as any)('activity_groups').select('group_id').eq('activity_id', route.params.id),
      (db.from as any)('activity_modes').select('*').eq('activity_id', route.params.id).order('sort_order').order('name'),
    ])

    activity.value = act
    allBookables.value = bookables ?? []
    linkedBookableIds.value = (venueLinks ?? []).map((l: any) => l.bookable_id)
    allGroups.value = groups ?? []
    linkedGroupIds.value = (groupLinks ?? []).map((l: any) => l.group_id)
    modes.value = modeData ?? []

    if (act) {
      form.name = act.name
      form.description = act.description ?? ''
      form.image_url = act.image_url ?? ''
      form.color = act.color ?? COLORS[0]
      form.icon = act.icon ?? 'pi-bolt'
      form.status = act.status ?? 'ACTIVE'
      form.require_mode = act.require_mode ?? false
      form.area_name_singular = act.area_name_singular ?? ''
      form.area_name_plural = act.area_name_plural ?? ''
      form.bookings_enabled = act.bookings_enabled ?? true
      form.allow_multi_slot = act.allow_multi_slot ?? false
      form.allow_multi_slot_peak = act.allow_multi_slot_peak ?? false
      form.allow_kiosk = act.allow_kiosk ?? false
      form.allow_recurring = act.allow_recurring ?? false
      form.allow_member_changes = act.allow_member_changes ?? false
      form.auto_remove_unpaid = act.auto_remove_unpaid ?? false
      form.require_visitor_names = act.require_visitor_names ?? false
      form.hide_member_names = act.hide_member_names ?? false
      form.approval_mode = act.approval_mode ?? 'auto'
      form.booking_flow = act.booking_flow ?? 'wizard'
      form.mode_label = act.mode_label ?? 'Mode'
      form.mode_display = (act.mode_display ?? 'grid') as 'grid' | 'list'
      form.booking_window_days = act.booking_window_days ?? null
      form.min_notice_hours = act.min_notice_hours ?? null
      form.cancellation_window_hours = act.cancellation_window_hours ?? null
      form.min_duration_mins = act.min_duration_mins ?? null
      form.max_duration_mins = act.max_duration_mins ?? null
      form.buffer_mins = act.buffer_mins ?? null
      bookingWindowUnit.value = inferWindowUnit(form.booking_window_days)
      bookingWindowDisplay.value = daysToDisplay(form.booking_window_days, bookingWindowUnit.value)
      minNoticeUnit.value = inferHoursUnit(form.min_notice_hours)
      minNoticeDisplay.value = hoursToDisplay(form.min_notice_hours, minNoticeUnit.value)
      cancellationUnit.value = inferHoursUnit(form.cancellation_window_hours)
      cancellationDisplay.value = hoursToDisplay(form.cancellation_window_hours, cancellationUnit.value)
    }
  } finally {
    loading.value = false
  }
}

async function save() {
  if (!form.name.trim()) return
  saving.value = true
  try {
    const { data } = await (db.from as any)('activities')
      .update({
        name: form.name.trim(), description: form.description.trim() || null,
        image_url: form.image_url || null,
        color: form.color, icon: form.icon, status: form.status, require_mode: form.require_mode,
        area_name_singular: form.area_name_singular.trim() || null,
        area_name_plural: form.area_name_plural.trim() || null,
        bookings_enabled: form.bookings_enabled,
        allow_multi_slot: form.allow_multi_slot,
        allow_multi_slot_peak: form.allow_multi_slot_peak,
        allow_kiosk: form.allow_kiosk,
        allow_recurring: form.allow_recurring,
        allow_member_changes: form.allow_member_changes,
        auto_remove_unpaid: form.auto_remove_unpaid,
        require_visitor_names: form.require_visitor_names,
        hide_member_names: form.hide_member_names,
        approval_mode: form.approval_mode,
        booking_flow: form.booking_flow,
        mode_label: form.mode_label.trim() || 'Mode',
        mode_display: form.mode_display,
        booking_window_days: form.booking_window_days,
        min_notice_hours: form.min_notice_hours,
        cancellation_window_hours: form.cancellation_window_hours,
        min_duration_mins: form.min_duration_mins,
        max_duration_mins: form.max_duration_mins,
        buffer_mins: form.buffer_mins,
      })
      .eq('id', route.params.id).select().single()
    activity.value = data
  } finally {
    saving.value = false
  }
}

async function deleteMode(id: string) {
  if (!confirm('Delete this mode?')) return
  await (db.from as any)('activity_modes').delete().eq('id', id)
  modes.value = modes.value.filter(m => m.id !== id)
}

// Tracks the mode being cloned so the Clone button can show a brief
// "…" while we copy the row + its bookable scope.
const cloningModeId = ref<string | null>(null)

async function cloneMode(source: any) {
  if (!source?.id) return
  cloningModeId.value = source.id
  try {
    // Drop server-managed columns and the original id; everything else
    // (pricing, addons, configuration_key, payment_options, allow_visitors,
    // approval_mode, form_id, etc.) carries over to the duplicate.
    const { id: _id, created_at: _ca, updated_at: _ua, ...rest } = source
    const cloneName = `${source.name} (copy)`
    const nextSortOrder = (modes.value.reduce((max, m) => Math.max(max, m.sort_order ?? 0), 0)) + 1
    const { data: created, error } = await (db.from as any)('activity_modes')
      .insert({ ...rest, name: cloneName, sort_order: nextSortOrder })
      .select('*')
      .single()
    if (error || !created?.id) throw error ?? new Error('Could not clone mode')

    // Copy per-mode bookable scope so the clone is bookable on the same
    // venues as the source. activity_mode_bookables is the join table.
    const { data: scopeRows } = await (db.from as any)('activity_mode_bookables')
      .select('bookable_id')
      .eq('mode_id', source.id)
    const scopeIds = ((scopeRows ?? []) as { bookable_id: string }[]).map(r => r.bookable_id)
    if (scopeIds.length) {
      await (db.from as any)('activity_mode_bookables').insert(
        scopeIds.map(bid => ({ mode_id: created.id, bookable_id: bid })),
      )
    }

    modes.value = [...modes.value, created]
    toast.add({ severity: 'success', summary: 'Mode cloned', detail: `"${cloneName}" created.`, life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not clone mode', detail: e?.message ?? 'Unknown error', life: 4000 })
  } finally {
    cloningModeId.value = null
  }
}

async function saveVenueLinks() {
  const id = route.params.id as string
  await (db.from as any)('activity_bookables').delete().eq('activity_id', id)
  if (linkedBookableIds.value.length) {
    await (db.from as any)('activity_bookables').insert(
      linkedBookableIds.value.map(bid => ({ activity_id: id, bookable_id: bid }))
    )
  }
}

async function saveGroupLinks() {
  const id = route.params.id as string
  await (db.from as any)('activity_groups').delete().eq('activity_id', id)
  if (linkedGroupIds.value.length) {
    await (db.from as any)('activity_groups').insert(
      linkedGroupIds.value.map(gid => ({ activity_id: id, group_id: gid }))
    )
  }
}

async function unlinkVenue(bookableId: string) {
  linkedBookableIds.value = linkedBookableIds.value.filter(id => id !== bookableId)
  await saveVenueLinks()
}

async function unlinkGroup(groupId: string) {
  linkedGroupIds.value = linkedGroupIds.value.filter(id => id !== groupId)
  await saveGroupLinks()
}

async function deleteActivity() {
  if (!confirm(`Delete "${activity.value?.name}"? This cannot be undone.`)) return
  await (db.from as any)('activities').delete().eq('id', route.params.id)
  navigateTo('/activities')
}

onMounted(load)
</script>
