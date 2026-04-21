<template>
  <div class="flex-1 overflow-hidden flex flex-col bg-white">
    <!-- Header -->
    <div class="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
      <div class="w-8 h-8 rounded-full bg-[#1E2157]/10 flex items-center justify-center shrink-0">
        <i class="pi pi-calendar text-[#1E2157] text-sm" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="font-semibold text-gray-900 truncate">{{ session.title || 'Untitled Session' }}</p>
        <div class="flex flex-col gap-0.5 mt-0.5">
          <p class="text-xs text-gray-400 flex items-center gap-1.5">
            <i class="pi pi-calendar text-[10px]" />
            <span v-if="session._startDate">{{ fmtDate(session._startDate) }}</span>
            <span v-else class="italic">No date set</span>
          </p>
          <p class="text-xs text-gray-400 flex items-center gap-1.5">
            <i class="pi pi-map-marker text-[10px]" />
            <span>{{ locationSummary }}</span>
          </p>
        </div>
      </div>
      <!-- Linked sessions count (master only) -->
      <div v-if="session.is_master && linkedSessionCount > 0"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 shrink-0">
        <i class="pi pi-link text-purple-500 text-xs" />
        <span class="text-xs font-semibold text-purple-700">{{ linkedSessionCount }} session{{ linkedSessionCount !== 1 ? 's' : '' }} inheriting</span>
      </div>

      <!-- Role selector -->
      <div class="flex flex-col items-end gap-1.5 shrink-0">
        <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          <button type="button" class="px-3 py-1.5 transition-colors"
            :class="!session.is_master && !session.master_id ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50 bg-white'"
            @click="setRole('standalone')">Standalone</button>
          <button type="button" class="px-3 py-1.5 transition-colors border-l border-gray-200 flex items-center gap-1"
            :class="session.is_master ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50 bg-white'"
            @click="setRole('master')"><i class="pi pi-crown text-[9px]" />Master</button>
          <button type="button" class="px-3 py-1.5 transition-colors border-l border-gray-200 flex items-center gap-1"
            :class="[session.master_id ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50 bg-white', !availableMasters.length ? 'opacity-40 cursor-not-allowed' : '']"
            :disabled="!availableMasters.length"
            @click="setRole('linked')"><i class="pi pi-link text-[9px]" />Linked</button>
        </div>
        <div v-if="session.master_id" class="flex items-center gap-1">
          <Select v-model="session.master_id"
            :options="availableMasters.map(s => ({ label: s.title || 'Untitled', value: sessionId(s) }))"
            option-label="label" option-value="value" size="small" placeholder="Select master" class="w-44"
            @update:model-value="v => { if (!v) session._locked_fields = [] }" />
          <Button icon="pi pi-refresh" size="small" text severity="secondary" class="!h-7 !w-7"
            v-tooltip.bottom="'Sync all fields from master'"
            @click="emit('syncFromMaster')" />
          <Button icon="pi pi-arrow-right" size="small" text severity="secondary" class="!h-7 !w-7"
            v-tooltip.bottom="'Go to master session'"
            @click="emit('goToMaster', session.master_id)" />
        </div>
      </div>
      <Button icon="pi pi-trash" size="small" text severity="danger" @click="emit('delete')" />
    </div>

    <!-- Tab nav -->
    <div class="flex items-center gap-1.5 px-6 py-3 border-b border-gray-100 flex-wrap shrink-0">
      <button v-for="t in tabs" :key="t.key"
        class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="activeTab === t.key ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        @click="activeTab = t.key">
        <i :class="`pi ${t.icon} text-xs`" />{{ t.label }}
      </button>
      <Button label="Take Attendance" icon="pi pi-check-square" size="small" class="ml-auto"
        style="background:#2494D2; border-color:#2494D2" @click="emit('takeAttendance', sessionId(props.session))" />
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA] px-6 py-6">

      <!-- OVERVIEW -->
      <div v-if="activeTab === 'overview'" class="space-y-6">

        <!-- Session Info -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Session Info</h2>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Title -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div class="flex items-center gap-3">
                <div class="grid grid-cols-[120px_1fr] items-center gap-4 flex-1">
                  <label class="text-sm font-medium text-gray-700">Session Title</label>
                  <InputText v-model="session.title" placeholder="Enter the name of this session" class="w-full" :disabled="isLocked('title')" />
                </div>
                <span v-if="session.is_master && inheritingCount('title') > 0"
                  class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0">
                  <i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('title') }} inheriting</span>
                <template v-if="session.master_id">
                  <button v-if="isLocked('title')" type="button"
                    class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0"
                    @click="unlock('title')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
                  <button v-else type="button"
                    class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0"
                    :class="differs('title') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'"
                    @click="pullFromMaster('title')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
                </template>
              </div>
            </div>
            <!-- Description -->
            <div class="px-5 py-4">
              <div class="flex gap-3">
                <div class="grid grid-cols-[120px_1fr] gap-4 flex-1">
                  <label class="text-sm font-medium text-gray-700 pt-1">Description</label>
                  <RichTextEditor :modelValue="session.description ?? ''" @update:modelValue="session.description = $event" placeholder="Describe this session…" :readonly="isLocked('description')" />
                </div>
                <div class="shrink-0 pt-1">
                  <span v-if="session.is_master && inheritingCount('description') > 0"
                    class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0">
                    <i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('description') }} inheriting</span>
                  <template v-if="session.master_id">
                    <button v-if="isLocked('description')" type="button"
                      class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors"
                      @click="unlock('description')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
                    <button v-else type="button"
                      class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors"
                      :class="differs('description') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'"
                      @click="pullFromMaster('description')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Date -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Date</h2>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors group"
              :class="fieldOpen.date ? 'border-b border-gray-100 bg-gray-50' : ''"
              @click="fieldOpen.date = !fieldOpen.date">
              <span class="text-sm flex-1" :class="dateDisplay.start ? 'text-gray-700' : 'text-gray-400 italic'">
                <template v-if="dateDisplay.start">
                  {{ dateDisplay.start }}<template v-if="dateDisplay.end"><span class="mx-[10px] text-gray-400">→</span>{{ dateDisplay.end }}</template>
                </template>
                <template v-else>No date set</template>
              </span>
              <span v-if="dateDisplay.days !== null"
                class="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1E2157]/10 text-[#1E2157]">
                {{ dateDisplay.days }} {{ dateDisplay.days === 1 ? 'day' : 'days' }}
              </span>
              <i class="pi text-sm text-gray-300 group-hover:text-gray-500 transition-colors shrink-0"
                :class="fieldOpen.date ? 'pi-chevron-up' : 'pi-chevron-down'" />
            </div>
            <DateTimeEditor v-if="fieldOpen.date"
              v-model:startDate="session._startDate"
              v-model:endDate="session._endDate"
              v-model:startTime="session._startTime"
              v-model:endTime="session._endTime"
              v-model:isAllDay="session.is_all_day"
              v-model:repeat="session.repeat"
              :showCustomRepeat="showCustomRepeat"
              :showOutsideEventDates="showOutsideEventDates"
              :outsideEventDates="session.session_kind !== 'regular'"
              :minStartDate="session.session_kind === 'regular' && eventStartDate ? eventStartDate : undefined"
              :maxDate="session.session_kind === 'regular' && eventEndDate ? eventEndDate : null"
              @update:outsideEventDates="v => { session.session_kind = v ? 'pre_event' : 'regular'; if (!v) { session._startDate = null; session._endDate = null; emit('dateChange') } }"
              @change="emit('dateChange')"
              @customRepeat="emit('customRepeat')"
            />
          </div>
        </div>

        <!-- Location -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Location</h2>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors group"
              :class="fieldOpen.location ? 'border-b border-gray-100 bg-gray-50' : ''"
              @click="fieldOpen.location = !fieldOpen.location">
              <span class="text-sm text-gray-700 flex-1 truncate">{{ locationSummary }}</span>
              <span v-if="session.is_master && inheritingCount('location_type') > 0"
                class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0">
                <i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('location_type') }} inheriting</span>
              <template v-if="session.master_id">
                <button v-if="isLocked('location_type')" type="button"
                  class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0"
                  @click.stop="unlock(['location_type', 'address', 'meeting_link'])"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
                <button v-else type="button"
                  class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0"
                  :class="(differs('location_type') || differs('address') || differs('meeting_link')) ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'"
                  @click.stop="pullFromMaster(['location_type', 'address', 'meeting_link'])"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
              </template>
              <i class="pi text-sm text-gray-300 group-hover:text-gray-500 transition-colors shrink-0"
                :class="fieldOpen.location ? 'pi-chevron-up' : 'pi-chevron-down'" />
            </div>
            <div v-if="fieldOpen.location" class="p-5" :class="{ 'opacity-60 pointer-events-none': isLocked('location_type') }">
              <LocationEditor v-model="session._locations" :multi="false"
                :startAt="locationStartAt"
                :endAt="locationEndAt"
                :excludeEventId="resolvedEventId"
                @update:summary="v => { locationSummary = v; session._locationSummary = v }" />
            </div>
          </div>
        </div>

        <!-- Extra slot (sub-sessions, etc.) -->
        <slot name="overview-extra" />

      </div>

      <!-- SETTINGS -->
      <div v-else-if="activeTab === 'settings'" class="space-y-4">
        <div class="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          <!-- Required -->
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Required</p>
              <p class="text-xs text-gray-500">Attendees must register for this session</p>
            </div>
            <span v-if="session.is_master && inheritingCount('is_required') > 0" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0"><i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('is_required') }} inheriting</span>
            <template v-if="session.master_id">
              <button v-if="isLocked('required')" type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0" @click="unlock('required')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
              <button v-else type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0" :class="differs('required') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'" @click="pullFromMaster('required')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
            </template>
            <ToggleSwitch v-model="session.required" :disabled="isLocked('required')" class="shrink-0" />
          </div>
          <!-- Public session -->
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Public session</p>
              <p class="text-xs text-gray-500">Visible to all registrants</p>
            </div>
            <span v-if="session.is_master && inheritingCount('is_public') > 0" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0"><i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('is_public') }} inheriting</span>
            <template v-if="session.master_id">
              <button v-if="isLocked('is_public')" type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0" @click="unlock('is_public')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
              <button v-else type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0" :class="differs('is_public') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'" @click="pullFromMaster('is_public')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
            </template>
            <ToggleSwitch v-model="session.is_public" :disabled="isLocked('is_public')" class="shrink-0" />
          </div>
          <!-- Show attendee list -->
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Show attendee list</p>
              <p class="text-xs text-gray-500">Registrants can see who else is attending</p>
            </div>
            <span v-if="session.is_master && inheritingCount('show_attendee_list') > 0" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0"><i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('show_attendee_list') }} inheriting</span>
            <template v-if="session.master_id">
              <button v-if="isLocked('show_attendee_list')" type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0" @click="unlock('show_attendee_list')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
              <button v-else type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0" :class="differs('show_attendee_list') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'" @click="pullFromMaster('show_attendee_list')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
            </template>
            <ToggleSwitch v-model="session.show_attendee_list" :disabled="isLocked('show_attendee_list')" class="shrink-0" />
          </div>
          <!-- Limit capacity -->
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Limit capacity</p>
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-xs text-gray-500">Set max registrations</p>
                <template v-if="session._hasCapacity">
                  <InputNumber v-model="session.capacity_max" :min="1" size="small" placeholder="Max" class="w-20" :disabled="isLocked('_hasCapacity')" />
                  <span class="text-xs text-gray-500">spots</span>
                </template>
              </div>
            </div>
            <span v-if="session.is_master && inheritingCount('capacity_max') > 0" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0"><i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('capacity_max') }} inheriting</span>
            <template v-if="session.master_id">
              <button v-if="isLocked('_hasCapacity')" type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0" @click="unlock(['_hasCapacity', 'capacity_max'])"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
              <button v-else type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0" :class="(differs('_hasCapacity') || differs('capacity_max')) ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'" @click="pullFromMaster(['_hasCapacity', 'capacity_max'])"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
            </template>
            <ToggleSwitch v-model="session._hasCapacity" class="ml-1 shrink-0" :disabled="isLocked('_hasCapacity')" @update:model-value="v => { if (!v) session.capacity_max = null }" />
          </div>
          <!-- Enable waitlist (conditional) -->
          <div v-if="session._hasCapacity" class="flex items-center gap-3 px-4 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Enable waitlist</p>
              <p class="text-xs text-gray-500">Overflow joins a waitlist</p>
            </div>
            <span v-if="session.is_master && inheritingCount('has_waitlist') > 0" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0"><i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('has_waitlist') }} inheriting</span>
            <template v-if="session.master_id">
              <button v-if="isLocked('has_waitlist')" type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0" @click="unlock('has_waitlist')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
              <button v-else type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0" :class="differs('has_waitlist') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'" @click="pullFromMaster('has_waitlist')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
            </template>
            <ToggleSwitch v-model="session.has_waitlist" :disabled="isLocked('has_waitlist')" class="shrink-0" />
          </div>
          <!-- Show as separate event on calendar -->
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Show as separate event on calendar</p>
              <p class="text-xs text-gray-500">This session appears as its own event in the calendar view</p>
            </div>
            <ToggleSwitch v-model="session.show_as_separate_event" class="shrink-0" />
          </div>
          <!-- Display on registration form -->
          <div class="flex items-center gap-3 px-4 py-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Display on registration form</p>
              <p class="text-xs text-gray-500">Show this session in the sessions section of the registration form</p>
            </div>
            <ToggleSwitch v-model="session.display_on_form" class="shrink-0" />
          </div>
        </div>

        <!-- Administrators -->
        <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-700">Administrators</p>
              <p class="text-xs text-gray-500">People who can manage this session</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="session.is_master && inheritingCount('admins') > 0" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0"><i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount('admins') }} inheriting</span>
              <template v-if="session.master_id">
                <button v-if="isLocked('admins')" type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors" @click="unlock('admins')"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
                <button v-else type="button" class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors" :class="differs('admins') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'" @click="pullFromMaster('admins')"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
              </template>
              <button type="button" :disabled="isLocked('admins')" class="flex items-center gap-1 text-xs text-[#1E2157] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                @click="!isLocked('admins') && (session.admins = [...(session.admins ?? []), { name: '', email: '', role: '' }])">
                <i class="pi pi-plus text-[10px]" /> Add
              </button>
            </div>
          </div>
          <div v-if="!(session.admins?.length)" class="px-4 py-4 text-xs text-gray-400 italic">No administrators added</div>
          <div v-for="(admin, ai) in (session.admins ?? [])" :key="ai" class="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 last:border-0" :class="{ 'opacity-50 pointer-events-none': isLocked('admins') }">
            <input v-model="admin.name" type="text" placeholder="Name" class="flex-1 text-sm bg-transparent border-0 outline-none placeholder-gray-400 text-gray-800" />
            <input v-model="admin.email" type="email" placeholder="Email (optional)" class="flex-1 text-sm bg-transparent border-0 outline-none placeholder-gray-400 text-gray-800" />
            <input v-model="admin.role" type="text" placeholder="Role (optional)" class="w-28 text-sm bg-transparent border-0 outline-none placeholder-gray-400 text-gray-800" />
            <button type="button" class="text-gray-300 hover:text-red-500 transition-colors" @click="session.admins.splice(ai, 1)">
              <i class="pi pi-times text-xs" />
            </button>
          </div>
        </div>

        <slot name="settings-extra" />
      </div>

      <!-- INVITEES -->
      <div v-else-if="activeTab === 'invitees'" class="space-y-6">

        <!-- ① Eligibility restrictions -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-gray-900">Eligibility</h3>
              <p class="text-xs text-gray-500 mt-0.5">Who is allowed to register for this session</p>
            </div>
            <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
              <button type="button"
                class="px-3 py-1.5 transition-colors"
                :class="!sessionEligibility.restricted ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50 bg-white'"
                @click="setEligibilityRestricted(false)">
                Open to all
              </button>
              <button type="button"
                class="px-3 py-1.5 transition-colors border-l border-gray-200"
                :class="sessionEligibility.restricted ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50 bg-white'"
                @click="setEligibilityRestricted(true)">
                Restricted
              </button>
            </div>
          </div>

          <template v-if="sessionEligibility.restricted">
            <div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
              <i class="pi pi-info-circle mt-0.5 shrink-0" />
              <span>Only people who meet <strong>all</strong> conditions below can register for this session.</span>
            </div>
            <ConditionEditor
              :model-value="sessionEligibility.conditions"
              @update:model-value="v => { sessionEligibility.conditions = v; session._eligibility = sessionEligibility }" />
          </template>

          <div v-else class="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
            <i class="pi pi-check-circle text-green-400" />
            Anyone can register for this session
          </div>
        </div>

        <!-- Divider -->
        <div class="border-t border-gray-100" />

        <!-- ② Who is invited -->
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <h3 class="text-sm font-semibold text-gray-900">Who is invited</h3>
              <p class="text-xs text-gray-500 mt-0.5">Who receives the registration form for this session</p>
            </div>
            <span v-if="session.is_master && inheritingCount(['_inviteeModes', '_inviteeGroups']) > 0"
              class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 shrink-0">
              <i class="pi pi-link text-[9px] mr-0.5" />{{ inheritingCount(['_inviteeModes', '_inviteeGroups']) }} inheriting</span>
            <template v-if="session.master_id">
              <button v-if="isLocked('_inviteeModes')" type="button"
                class="text-[10px] font-medium px-2 py-0.5 rounded border border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors shrink-0"
                @click="unlock(['_inviteeModes', '_inviteeGroups'])"><i class="pi pi-lock text-[9px] mr-0.5" />Inherited</button>
              <button v-else type="button"
                class="text-[10px] font-medium px-2 py-0.5 rounded border transition-colors shrink-0"
                :class="differs('_inviteeModes') ? 'border-amber-300 bg-amber-50 text-amber-600 hover:bg-amber-100' : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300'"
                @click="pullInviteesFromMaster()"><i class="pi pi-crown text-[9px] mr-0.5" />From master</button>
            </template>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100" :class="isLocked('_inviteeModes') ? 'opacity-60 pointer-events-none' : ''">
            <button
              v-for="opt in inviteeModes" :key="opt.value"
              type="button"
              class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              @click="toggleInviteeMode(opt.value)">
              <i :class="[`pi ${opt.icon}`, 'text-sm w-4 shrink-0', sessionInviteeModes.includes(opt.value) ? 'text-[#1E2157]' : 'text-gray-400']" />
              <div class="flex-1 text-left">
                <p class="text-sm font-medium" :class="sessionInviteeModes.includes(opt.value) ? 'text-[#1E2157]' : 'text-gray-700'">{{ opt.label }}</p>
                <p class="text-xs text-gray-400">{{ opt.sub }}</p>
              </div>
              <div class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                :class="sessionInviteeModes.includes(opt.value) ? 'bg-[#1E2157] border-[#1E2157]' : 'border-gray-300'">
                <i v-if="sessionInviteeModes.includes(opt.value)" class="pi pi-check text-white text-[10px]" />
              </div>
            </button>
          </div>

          <!-- Specific groups picker -->
          <div v-if="sessionInviteeModes.includes('groups')" class="space-y-2">
            <p class="text-xs text-gray-500">Select which member groups are invited to this session</p>
            <MultiSelect
              v-model="sessionInviteeGroups"
              :options="allInviteeMemberGroups"
              option-label="name"
              option-value="id"
              placeholder="Select groups…"
              display="chip"
              :max-selected-labels="4"
              class="w-full"
              :disabled="isLocked('_inviteeModes')"
              @update:model-value="v => { session._inviteeGroups = v }" />
          </div>
        </div>

      </div>

      <!-- FEES -->
      <div v-else-if="activeTab === 'fees'" class="space-y-4">
        <FeeGroupsEditor
          :model-value="session._feesConfig ?? defaultFeesConfig()"
          :master-fees-config="masterSession?._feesConfig"
          context="session"
          @update:model-value="v => session._feesConfig = v" />
      </div>

      <!-- Extra tabs via slot -->
      <slot :name="`tab-${activeTab}`" />

    </div>
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { defaultFeesConfig } from '~/composables/useFeeGroups'

const props = withDefaults(defineProps<{
  session: any
  allSessions: any[]
  showOutsideEventDates?: boolean
  showCustomRepeat?: boolean
  tabs: { key: string; label: string; icon: string }[]
  initialTab?: string
  eventId?: string
  eventStartDate?: Date | null
  eventEndDate?: Date | null
}>(), {
  showOutsideEventDates: false,
  showCustomRepeat: false,
  initialTab: 'overview',
  eventStartDate: null,
  eventEndDate: null,
})

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'goToMaster', id: string): void
  (e: 'syncFromMaster'): void
  (e: 'dateChange'): void
  (e: 'customRepeat'): void
  (e: 'takeAttendance', sessionId: string): void
}>()

const db = useDb()

const activeTab = ref(props.initialTab)
const fieldOpen = reactive({ date: true, location: hasLocation(props.session) })

// Invitee mode for session
const inviteeModes = [
  { value: 'all_members', label: 'All members',      sub: 'Send to your full member list',           icon: 'pi-users' },
  { value: 'invitees',    label: 'Event invitees',   sub: 'People already added to this event',      icon: 'pi-user-check' },
  { value: 'public',      label: 'Public',           sub: 'Open link — no outbound sending needed',  icon: 'pi-globe' },
  { value: 'groups',      label: 'Specific groups',  sub: 'Choose which member groups are invited',  icon: 'pi-filter' },
]
const sessionInviteeModes = ref<string[]>(props.session._inviteeModes ?? ['all_members'])
const sessionInviteeGroups = ref<string[]>(props.session._inviteeGroups ?? [])

watch(() => props.session, s => {
  sessionInviteeModes.value = s._inviteeModes ?? ['all_members']
  sessionInviteeGroups.value = s._inviteeGroups ?? []
  sessionEligibility.restricted = s._eligibility?.restricted ?? false
  sessionEligibility.conditions = s._eligibility?.conditions ?? []
})

function toggleInviteeMode(value: string) {
  const idx = sessionInviteeModes.value.indexOf(value)
  if (idx >= 0) sessionInviteeModes.value.splice(idx, 1)
  else sessionInviteeModes.value.push(value)
  props.session._inviteeModes = [...sessionInviteeModes.value]
}

const allInviteeMemberGroups = ref<{ id: string; name: string }[]>([])

const sessionEligibility = reactive<{ restricted: boolean; conditions: any[] }>({
  restricted: props.session._eligibility?.restricted ?? false,
  conditions: props.session._eligibility?.conditions ?? [],
})

function setEligibilityRestricted(v: boolean) {
  sessionEligibility.restricted = v
  props.session._eligibility = { ...sessionEligibility, restricted: v }
}

// Draft event for session-specific invitees (used when no eventId prop is provided)
const sessionDraftEventId = ref<string | null>(null)
const creatingDraft = ref(false)
const resolvedEventId = computed(() => props.eventId ?? sessionDraftEventId.value ?? undefined)

async function ensureDraftEvent() {
  if (resolvedEventId.value || creatingDraft.value) return
  creatingDraft.value = true
  const { data } = await db.from('events').insert({ org_id: orgId.value, title: '(draft)', style: 'ADVANCED', status: 'DRAFT' }).select('id').single()
  if (data) sessionDraftEventId.value = data.id
  creatingDraft.value = false
}

onMounted(async () => {
  const { data } = await db.from('member_groups').select('id, name').eq('org_id', orgId.value).order('name')
  allInviteeMemberGroups.value = data ?? []
})

function hasLocation(session: any): boolean {
  const loc = session._locations?.[0]
  if (!loc) return false
  if (loc.type === 'ADDRESS') return !!(loc.venue_name || loc.address)
  if (loc.type === 'ONLINE') return !!loc.meeting_link
  if (loc.type === 'BOOKABLE') return !!(loc.bookable_ids?.length || session.bookable_id)
  return false
}

// Reset when session changes
watch(() => props.session, () => {
  activeTab.value = 'overview'
  fieldOpen.date = !props.session._startDate
  fieldOpen.location = hasLocation(props.session)
})

// ---- Session ID helper (works for both DB id and _tempId) ----
function sessionId(s: any): string {
  return s.id ?? s._tempId
}

// ---- Master helpers ----
const linkedSessionCount = computed(() =>
  props.allSessions.filter(s => s.master_id && (s.master_id === props.session.id || s.master_id === props.session._savedId)).length
)

function inheritingCount(fields: string | string[]): number {
  if (!props.session.is_master) return 0
  const keys = Array.isArray(fields) ? fields : [fields]
  const masterId = props.session._savedId ?? props.session.id
  return props.allSessions.filter(s =>
    (s.master_id === masterId) &&
    keys.some((f: string) => (s._locked_fields ?? []).includes(f))
  ).length
}

const TAB_INHERIT_FIELDS: Record<string, string[]> = {
  overview: ['title', 'description', 'location_type', 'address', 'meeting_link'],
  invitees: ['_inviteeModes', '_inviteeGroups', '_eligibility'],
  fees:     ['fees'],
  settings: ['is_required', 'capacity_max', 'has_waitlist', 'display_on_form', 'is_public', 'show_attendee_list', 'show_as_separate_event', 'admins'],
}

function tabInheritingCount(tabKey: string): number {
  return inheritingCount(TAB_INHERIT_FIELDS[tabKey] ?? [])
}

const availableMasters = computed(() =>
  props.allSessions.filter(s => s.is_master && sessionId(s) !== sessionId(props.session))
)

const masterSession = computed(() =>
  props.session.master_id
    ? props.allSessions.find(s => sessionId(s) === props.session.master_id)
    : null
)

function setRole(role: 'standalone' | 'master' | 'linked') {
  if (role === 'standalone') {
    props.session.is_master = false
    props.session.master_id = null
    props.session._locked_fields = []
    props.allSessions.forEach(s => {
      if (s.master_id === sessionId(props.session)) s.master_id = null
    })
  } else if (role === 'master') {
    props.session.is_master = true
    props.session.master_id = null
    props.session._locked_fields = []
    props.allSessions.forEach(s => {
      if (s.master_id === sessionId(props.session)) s.master_id = null
    })
  } else if (role === 'linked' && availableMasters.value.length) {
    props.session.is_master = false
    if (!props.session.master_id) {
      props.session.master_id = sessionId(availableMasters.value[0])
    }
  }
}

function isLocked(field: string): boolean {
  return (props.session._locked_fields ?? []).includes(field)
}

function differs(field: string): boolean {
  const master = props.allSessions.find(s => sessionId(s) === props.session.master_id)
  if (!master) return false
  return JSON.stringify(props.session[field]) !== JSON.stringify(master[field])
}

function pullFromMaster(fields: string | string[]) {
  const master = props.allSessions.find(s => sessionId(s) === props.session.master_id)
  if (!master) return
  const keys = Array.isArray(fields) ? fields : [fields]
  keys.forEach(f => {
    if (master[f] !== undefined) props.session[f] = JSON.parse(JSON.stringify(master[f]))
  })
  const locked = props.session._locked_fields ?? []
  keys.forEach(f => { if (!locked.includes(f)) locked.push(f) })
  props.session._locked_fields = locked
}

function unlock(fields: string | string[]) {
  const keys = Array.isArray(fields) ? fields : [fields]
  props.session._locked_fields = (props.session._locked_fields ?? []).filter((f: string) => !keys.includes(f))
}

function pullInviteesFromMaster() {
  pullFromMaster(['_inviteeModes', '_inviteeGroups'])
  sessionInviteeModes.value = props.session._inviteeModes ?? ['all_members']
  sessionInviteeGroups.value = props.session._inviteeGroups ?? []
}

// ---- Location availability ----
const locationStartAt = computed(() => {
  const d = props.session._startDate ? new Date(props.session._startDate) : null
  if (!d) return null
  const t = props.session._startTime ? new Date(props.session._startTime) : null
  if (t) d.setHours(t.getHours(), t.getMinutes(), 0, 0)
  else d.setHours(0, 0, 0, 0)
  return d.toISOString()
})

const locationEndAt = computed(() => {
  const base = props.session._endDate ?? props.session._startDate
  const d = base ? new Date(base) : null
  if (!d) return null
  const t = props.session._endTime ? new Date(props.session._endTime) : null
  if (t) d.setHours(t.getHours(), t.getMinutes(), 0, 0)
  else d.setHours(23, 59, 59, 0)
  return d.toISOString()
})

// ---- Date display ----
const dateDisplay = computed(() => {
  const s = props.session
  const fDate = (d: Date) => new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const fTime = (d: Date) => new Date(d).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })

  const startDate = s._startDate ? new Date(s._startDate) : null
  const endDate   = s._endDate   ? new Date(s._endDate)   : null
  const startTime = s._startTime ? new Date(s._startTime) : null
  const endTime   = s._endTime   ? new Date(s._endTime)   : null
  const sameDay   = startDate && endDate ? startDate.toDateString() === endDate.toDateString() : true

  if (!startDate) return { start: null, end: null, days: null }

  let start = ''
  let end: string | null = null

  if (s.is_all_day) {
    start = fDate(startDate)
    if (endDate && !sameDay) end = fDate(endDate)
  } else {
    const st = startTime ? fTime(startTime) : ''
    const et = endTime   ? fTime(endTime)   : ''
    if (sameDay || !endDate) {
      start = fDate(startDate) + (st ? `, ${st}` : '')
      if (et) end = et
    } else {
      start = fDate(startDate) + (st ? `, ${st}` : '')
      end = fDate(endDate!) + (et ? `, ${et}` : '')
    }
  }

  const days = (s.is_all_day && endDate && !sameDay)
    ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    : null

  return { start, end, days }
})

// ---- Location summary ----
function sessionLocationSummary(session: any): string {
  const loc = session._locations?.[0]
  if (!loc) return 'No location set'
  if (loc.type === 'ADDRESS') return [loc.venue_name, loc.address].filter(Boolean).join(', ') || 'No address'
  if (loc.type === 'ONLINE') return loc.meeting_link || 'Online'
  if (loc.type === 'BOOKABLE') return session._locationSummary || 'Venue'
  return 'No location set'
}

const locationSummary = ref(sessionLocationSummary(props.session))

watch(() => props.session, s => {
  locationSummary.value = sessionLocationSummary(s)
}, { deep: false })

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

</script>
