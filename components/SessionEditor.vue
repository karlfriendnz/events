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
    <div class="flex gap-1.5 px-6 py-3 border-b border-gray-100 flex-wrap shrink-0">
      <button v-for="t in tabs" :key="t.key"
        class="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors"
        :class="activeTab === t.key ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
        @click="activeTab = t.key">
        <i :class="`pi ${t.icon} text-xs`" />{{ t.label }}
      </button>
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
                  <RichTextEditor v-model="session.description" placeholder="Describe this session…" :readonly="isLocked('description')" />
                </div>
                <div class="shrink-0 pt-1">
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
        <slot name="settings-extra" />
      </div>

      <!-- INVITEES -->
      <div v-else-if="activeTab === 'invitees'" class="space-y-4">
        <!-- Mode selector -->
        <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
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

        <!-- Specific people picker -->
        <div v-if="sessionInviteeModes.includes('specific')" class="mt-2">
          <Suspense v-if="resolvedEventId">
            <EventInviteeManager :event-id="resolvedEventId" />
            <template #fallback>
              <div class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
                <i class="pi pi-spin pi-spinner text-2xl text-gray-300 block mb-2" />
                Loading&hellip;
              </div>
            </template>
          </Suspense>
          <div v-else class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-2xl text-gray-300 block mb-2" />
            Setting up&hellip;
          </div>
        </div>
      </div>

      <!-- FEES -->
      <div v-else-if="activeTab === 'fees'" class="space-y-4">
        <p class="text-xs text-gray-500">Fees can be customised per registration type</p>
        <FeeGroupsEditor
          :model-value="session._feeTypes ?? defaultFeeTypes"
          :master-fee-types="masterSession?._feeTypes"
          context="session"
          @update:model-value="v => session._feeTypes = v" />
      </div>

      <!-- Extra tabs via slot -->
      <slot :name="`tab-${activeTab}`" />

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { defaultRegistrationTypes } from '~/composables/useFeeGroups'
import { DEFAULT_ORG_ID } from '~/composables/useDb'

const defaultFeeTypes = defaultRegistrationTypes()

const props = withDefaults(defineProps<{
  session: any
  allSessions: any[]
  showOutsideEventDates?: boolean
  showCustomRepeat?: boolean
  tabs: { key: string; label: string; icon: string }[]
  initialTab?: string
  eventId?: string
}>(), {
  showOutsideEventDates: false,
  showCustomRepeat: false,
  initialTab: 'overview',
})

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'goToMaster', id: string): void
  (e: 'syncFromMaster'): void
  (e: 'dateChange'): void
  (e: 'customRepeat'): void
}>()

const db = useDb()

const activeTab = ref(props.initialTab)
const fieldOpen = reactive({ date: true, location: false })

// Invitee mode for session
const inviteeModes = [
  { value: 'everyone',  label: 'Everyone',        sub: 'All members',           icon: 'pi-users' },
  { value: 'invitees',  label: 'Event Invitees',   sub: 'People invited to this event', icon: 'pi-user-check' },
  { value: 'public',    label: 'Public',          sub: 'Open registration',     icon: 'pi-globe' },
  { value: 'specific',  label: 'Specific People', sub: 'Choose groups',         icon: 'pi-filter' },
]
const sessionInviteeModes = ref<string[]>(props.session._inviteeModes ?? [])
watch(sessionInviteeModes, v => { props.session._inviteeModes = v }, { deep: true })
watch(() => props.session, s => { sessionInviteeModes.value = s._inviteeModes ?? [] })

// Draft event for session-specific invitees (used when no eventId prop is provided)
const sessionDraftEventId = ref<string | null>(null)
const creatingDraft = ref(false)
const resolvedEventId = computed(() => props.eventId ?? sessionDraftEventId.value ?? undefined)

async function ensureDraftEvent() {
  if (resolvedEventId.value || creatingDraft.value) return
  creatingDraft.value = true
  const { data } = await db.from('events').insert({ org_id: DEFAULT_ORG_ID, title: '(draft)', style: 'ADVANCED', status: 'DRAFT' }).select('id').single()
  if (data) sessionDraftEventId.value = data.id
  creatingDraft.value = false
}

async function toggleInviteeMode(value: string) {
  const idx = sessionInviteeModes.value.indexOf(value)
  if (idx >= 0) {
    sessionInviteeModes.value.splice(idx, 1)
  } else {
    if (value === 'specific') await ensureDraftEvent()
    sessionInviteeModes.value.push(value)
  }
}

// Reset when session changes
watch(() => props.session, () => {
  activeTab.value = 'overview'
  fieldOpen.date = !props.session._startDate
  fieldOpen.location = false
})

// ---- Session ID helper (works for both DB id and _tempId) ----
function sessionId(s: any): string {
  return s.id ?? s._tempId
}

// ---- Master helpers ----
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
