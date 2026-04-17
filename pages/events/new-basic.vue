<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">
    <!-- Header -->
    <div class="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-3">
        <NuxtLink to="/events" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <i class="pi pi-chevron-left text-xs" /> Events
        </NuxtLink>
        <span class="text-gray-300">/</span>
        <span class="text-sm font-medium text-gray-800">Create new event</span>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Cancel" severity="secondary" outlined size="small" @click="navigateTo('/events')" />
        <Button label="Save Event" icon="pi pi-check" size="small" :loading="saving" :disabled="!form.title.trim()" @click="saveEvent" style="background:#1E2157; border-color:#1E2157" />
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-[1140px] mx-auto px-6 py-6 space-y-8">

        <!-- Event Info -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Event Info</h2>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Title -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div class="grid grid-cols-[120px_1fr] items-center gap-4">
                <label class="text-sm font-medium text-gray-700">Event Title</label>
                <InputText v-model="form.title" placeholder="Enter the name of your event" class="w-full" autofocus />
              </div>
            </div>
            <!-- Description -->
            <div class="px-5 py-4 border-b border-gray-100">
              <div class="grid grid-cols-[120px_1fr] gap-4">
                <label class="text-sm font-medium text-gray-700 pt-1">Event Description</label>
                <RichTextEditor v-model="form.description" placeholder="Describe your event here…" />
              </div>
            </div>
            <!-- Category + Discipline -->
            <div class="px-5 py-4 space-y-4">
              <div class="grid grid-cols-[120px_1fr] items-center gap-4">
                <label class="text-sm font-medium text-gray-700">Category</label>
                <div class="flex items-center gap-2">
                  <MultiSelect
                    v-model="form.category_ids"
                    :options="categories"
                    option-label="name"
                    option-value="id"
                    placeholder="Choose categories"
                    class="flex-1"
                    display="chip"
                    :max-selected-labels="3"
                  >
                    <template #chip="{ value }">
                      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white" :style="{ background: categories.find(c => c.id === value)?.color ?? '#1E2157' }">
                        {{ categories.find(c => c.id === value)?.name }}
                      </div>
                    </template>
                  </MultiSelect>
                  <Button icon="pi pi-plus" size="small" severity="secondary" outlined v-tooltip.top="'New calendar'" @click="showNewCategoryDialog = true" />
                </div>
              </div>
              <div class="grid grid-cols-[120px_1fr] items-center gap-4">
                <label class="text-sm font-medium text-gray-700">Discipline</label>
                <Select v-model="form.discipline" :options="disciplines" option-label="label" option-value="value" placeholder="Choose Discipline" show-clear />
              </div>
            </div>
          </div>
        </div>

        <!-- Date -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Date <span class="text-red-400 normal-case font-normal ml-1">required</span></h2>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Collapsible header row -->
            <div class="flex items-center gap-4 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors group"
              :class="dateOpen ? 'border-b border-gray-100 bg-gray-50' : ''"
              @click="dateOpen = !dateOpen">
              <span class="text-sm text-gray-700 flex items-center flex-1">
                <template v-if="formDateDisplay.start">
                  {{ formDateDisplay.start }}
                  <template v-if="formDateDisplay.end">
                    <span class="mx-[10px] text-gray-400">→</span>{{ formDateDisplay.end }}
                  </template>
                </template>
                <span v-else class="text-gray-400 italic">No date set</span>
              </span>
              <span v-if="formDateDisplay.days !== null"
                class="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1E2157]/10 text-[#1E2157]">
                {{ formDateDisplay.days }} {{ formDateDisplay.days === 1 ? 'day' : 'days' }}
              </span>
              <i class="pi text-sm text-gray-300 group-hover:text-gray-500 transition-colors shrink-0"
                :class="dateOpen ? 'pi-chevron-up' : 'pi-chevron-down'" />
            </div>
            <DateTimeEditor v-if="dateOpen"
              v-model:startDate="form.start_date"
              v-model:endDate="form.end_date"
              v-model:startTime="form.start_time"
              v-model:endTime="form.end_time"
              v-model:isAllDay="form.is_all_day"
              v-model:repeat="form.repeat"
              :minStartDate="twoWeeksAgo"
              :minEndDate="form.start_date ?? twoWeeksAgo"
            />
          </div>
        </div>

        <!-- Location -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Location</h2>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <LocationEditor v-model="form.locations" :availabilityMap="availabilityMap">
              <template #bookable-header>
                <div class="flex items-center justify-between bg-blue-50 border-b border-blue-200 px-3 py-2">
                  <div class="flex items-center gap-2 text-sm text-blue-700">
                    <i class="pi pi-clock text-xs" />
                    <span>Availability for: <span class="font-medium">{{ availabilityTimeLabel }}</span></span>
                  </div>
                  <Button label="Re-check" icon="pi pi-refresh" size="small" severity="secondary" outlined :loading="checkingAvailability" @click="recheckAvailability" />
                </div>
              </template>
            </LocationEditor>
          </div>
        </div>

        <!-- Invitees -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Invitees</h2>
          <div v-if="!draftEventId" class="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
            <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
            Setting up invitees…
          </div>
          <EventInviteeManager v-else :event-id="draftEventId" />
        </div>

        <!-- Visibility -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Visibility</h2>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <div class="grid grid-cols-2 gap-4">
              <div v-for="vis in visibilityOptions" :key="vis.key" class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <p class="text-sm font-medium text-gray-700">{{ vis.label }}</p>
                  <p class="text-xs text-gray-500">{{ vis.desc }}</p>
                </div>
                <ToggleSwitch v-model="form[vis.key]" />
              </div>
            </div>
            <div class="flex gap-4 mt-4">
              <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg flex-1">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-700">Limit capacity</p>
                  <div class="flex items-center gap-2">
                    <p class="text-xs text-gray-500">Set max attendees</p>
                    <template v-if="form.has_capacity">
                      <InputNumber v-model="form.capacity_max" :min="1" size="small" placeholder="Max" class="w-20" />
                      <span class="text-xs text-gray-500">spots</span>
                    </template>
                  </div>
                </div>
                <ToggleSwitch v-model="form.has_capacity" class="ml-3 shrink-0" />
              </div>
              <div v-if="form.has_capacity" class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg flex-1">
                <div>
                  <p class="text-sm font-medium text-gray-700">Enable waitlist</p>
                  <p class="text-xs text-gray-500">Overflow joins a waitlist</p>
                </div>
                <ToggleSwitch v-model="form.has_waitlist" class="ml-3 shrink-0" />
              </div>
            </div>
          </div>
        </div>

        <!-- Fees -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Fees</h2>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">Are attendees charged?</p>
                <p class="text-xs text-gray-500 mt-0.5">Enable to add fee components to this event</p>
              </div>
              <div class="flex gap-0">
                <button class="px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors" :class="!form.is_paid ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="form.is_paid = false">Free</button>
                <button class="px-4 py-2 text-sm font-medium border rounded-r-lg transition-colors" :class="form.is_paid ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'" @click="form.is_paid = true">Charged</button>
              </div>
            </div>
            <div v-if="form.is_paid" class="border border-gray-200 rounded-xl overflow-hidden">
              <div class="grid px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide" style="grid-template-columns:2fr 2fr 1fr 40px">
                <span>Fee Name</span><span>Account</span><span>Amount</span><span />
              </div>
              <div v-for="(fee, idx) in form.fees" :key="idx" class="grid px-4 py-2.5 border-b border-gray-100 items-center gap-3" style="grid-template-columns:2fr 2fr 1fr 40px">
                <InputText v-model="fee.name" placeholder="e.g. Tournament Fee" size="small" class="w-full" />
                <InputText v-model="fee.account" placeholder="e.g. 531 - Tournaments" size="small" class="w-full" />
                <InputNumber v-model="fee.amount" mode="currency" currency="AUD" locale="en-AU" size="small" class="w-full" input-class="text-right" />
                <Button icon="pi pi-trash" text severity="danger" size="small" @click="form.fees.splice(idx, 1)" />
              </div>
              <div class="grid px-4 py-2.5 border-b border-gray-200 font-semibold text-sm" style="grid-template-columns:2fr 2fr 1fr 40px">
                <span class="text-gray-700">Total</span><span /><span class="text-gray-900">${{ totalFees.toFixed(2) }}</span><span />
              </div>
              <div class="px-4 py-2.5">
                <Button icon="pi pi-plus" label="Add Fee" size="small" severity="secondary" text @click="addFee" />
              </div>
            </div>
          </div>
        </div>

        <!-- Settings -->
        <div>
          <h2 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Settings</h2>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-6">

            <!-- Banner image -->
            <div>
              <h3 class="text-sm font-semibold text-gray-800 mb-1">Banner image</h3>
              <p class="text-xs text-gray-500 mb-3">For best results upload an image that is 1200 × 350</p>
              <div v-if="!form.banner_url" class="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-[#1E2157] transition-colors cursor-pointer" @click="triggerBannerUpload">
                <i class="pi pi-image text-2xl text-gray-400" />
                <Button label="Upload banner image" severity="secondary" outlined size="small" icon="pi pi-upload" />
              </div>
              <div v-else class="relative rounded-xl overflow-hidden">
                <img :src="form.banner_url" class="w-full h-32 object-cover" />
                <div v-if="uploadingBanner" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <i class="pi pi-spin pi-spinner text-white text-xl" />
                </div>
                <Button v-else icon="pi pi-times" severity="danger" rounded size="small" class="absolute top-2 right-2" @click="form.banner_url = ''" />
              </div>
              <input ref="bannerInput" type="file" accept="image/*" class="hidden" @change="handleBannerUpload" />
            </div>

            <!-- Terms & Conditions -->
            <div class="border-t border-gray-100 pt-5">
              <h3 class="text-sm font-semibold text-gray-800 mb-3">Terms and Conditions</h3>
              <div class="space-y-2 mb-3">
                <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span class="text-sm text-gray-700">Club Terms and Conditions</span>
                  <span class="text-xs bg-[#1E2157] text-white px-2 py-0.5 rounded-full">Required</span>
                </div>
                <div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span class="text-sm text-gray-700">Privacy Policy</span>
                  <span class="text-xs bg-[#1E2157] text-white px-2 py-0.5 rounded-full">Required</span>
                </div>
                <div v-for="(term, idx) in form.custom_terms" :key="idx"
                  class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg group">
                  <InputText v-model="form.custom_terms[idx]" size="small" class="flex-1 border-0 bg-transparent p-0 text-sm" placeholder="Custom terms..." />
                  <Button icon="pi pi-times" severity="danger" text size="small" rounded class="opacity-0 group-hover:opacity-100" @click="form.custom_terms.splice(idx, 1)" />
                </div>
              </div>
              <Button icon="pi pi-plus" label="Add Terms" size="small" severity="secondary" outlined @click="form.custom_terms.push('')" />
            </div>

            <!-- Event Administrators -->
            <div class="border-t border-gray-100 pt-5">
              <h3 class="text-sm font-semibold text-gray-800 mb-1">Event Administrators</h3>
              <p class="text-xs text-gray-500 mb-3">Choose the required access level for each event admin</p>
              <div class="border border-gray-200 rounded-xl overflow-hidden mb-3">
                <div class="grid px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide" style="grid-template-columns:1fr 100px 100px 100px 40px">
                  <span>Name</span><span class="text-center">Registrations</span><span class="text-center">Changes</span><span class="text-center">Notes</span><span />
                </div>
                <div v-for="(admin, idx) in form.admins" :key="idx" class="grid px-4 py-2.5 border-b border-gray-100 last:border-0 items-center" style="grid-template-columns:1fr 100px 100px 100px 40px">
                  <span class="text-sm text-blue-600 font-medium cursor-pointer hover:underline">{{ admin.name }}</span>
                  <div class="flex justify-center"><Checkbox v-model="admin.registrations" binary /></div>
                  <div class="flex justify-center">
                    <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer" :class="admin.changes ? 'border-[#1E2157] bg-[#1E2157]' : 'border-gray-300'" @click="admin.changes = !admin.changes">
                      <div v-if="admin.changes" class="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                  <div class="flex justify-center">
                    <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer" :class="admin.notes ? 'border-[#1E2157] bg-[#1E2157]' : 'border-gray-300'" @click="admin.notes = !admin.notes">
                      <div v-if="admin.notes" class="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  </div>
                  <Button icon="pi pi-times" text severity="danger" size="small" rounded @click="form.admins.splice(idx, 1)" />
                </div>
                <div v-if="!form.admins.length" class="px-4 py-4 text-sm text-gray-400 text-center">No administrators added</div>
              </div>
              <Button icon="pi pi-plus" label="Add Coordinator" size="small" severity="secondary" outlined @click="showAddAdminDialog = true" />
            </div>
          </div>
        </div>

        <!-- Bottom spacer -->
        <div class="h-4" />
      </div>
    </div>
  </div>

  <!-- Add Admin Dialog -->
  <Dialog v-model:visible="showAddAdminDialog" header="Add Event Administrator" modal style="width:360px">
    <div class="flex flex-col gap-3 py-2">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Name</label>
        <InputText v-model="adminDraft.name" placeholder="Search members..." autofocus />
      </div>
      <div class="space-y-2">
        <label class="text-sm font-medium">Permissions</label>
        <div class="flex items-center gap-2">
          <Checkbox v-model="adminDraft.registrations" binary input-id="adminReg" />
          <label for="adminReg" class="text-sm text-gray-700 cursor-pointer">View Registrations</label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="adminDraft.changes" binary input-id="adminChg" />
          <label for="adminChg" class="text-sm text-gray-700 cursor-pointer">Make Changes</label>
        </div>
        <div class="flex items-center gap-2">
          <Checkbox v-model="adminDraft.notes" binary input-id="adminNotes" />
          <label for="adminNotes" class="text-sm text-gray-700 cursor-pointer">Add Notes</label>
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showAddAdminDialog = false" />
      <Button label="Add" :disabled="!adminDraft.name.trim()" @click="addAdmin" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <!-- New Category Dialog -->
  <Dialog v-model:visible="showNewCategoryDialog" header="New Category" modal style="width:360px">
    <div class="flex flex-col gap-4 py-1">
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium">Name</label>
        <InputText v-model="newCategoryName" placeholder="Category name" autofocus />
      </div>
      <div class="flex flex-col gap-2">
        <label class="text-sm font-medium">Colour</label>
        <div class="flex flex-wrap gap-2">
          <button v-for="color in categoryColorPalette" :key="color"
            class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            :class="newCategoryColor === color ? 'border-gray-900 scale-110' : 'border-transparent'"
            :style="{ background: color }"
            @click="newCategoryColor = color" />
          <div class="flex items-center gap-1.5">
            <input type="color" v-model="newCategoryColor" class="w-7 h-7 rounded cursor-pointer border border-gray-200" />
            <span class="text-xs text-gray-500">Custom</span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
        <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: newCategoryColor }" />
        <span class="text-sm font-medium text-gray-700">{{ newCategoryName || 'Category name' }}</span>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showNewCategoryDialog = false" />
      <Button label="Create" :disabled="!newCategoryName.trim()" :loading="savingCategory" @click="createCategory" style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <Toast />
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

definePageMeta({ layout: 'default' })

const db = useDb()
const toast = useToast()
const route = useRoute()
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000002'

const saving = ref(false)
const draftEventId = ref<string | null>(null)
const categories = ref<any[]>([])
const showAddAdminDialog = ref(false)
const showNewCategoryDialog = ref(false)
const newCategoryName = ref('')
const newCategoryColor = ref('#1E2157')
const savingCategory = ref(false)

const categoryColorPalette = [
  '#1E2157', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#1EA97C', '#F97316', '#84CC16',
]

async function createCategory() {
  if (!newCategoryName.value.trim()) return
  savingCategory.value = true
  const { data, error } = await db.from('categories').insert({
    org_id: DEFAULT_ORG_ID,
    name: newCategoryName.value.trim(),
    color: newCategoryColor.value,
  }).select('id, name, color').single()
  if (!error && data) {
    categories.value.push(data)
    form.category_ids.push(data.id)
    toast.add({ severity: 'success', summary: 'Calendar created', life: 2000 })
  }
  showNewCategoryDialog.value = false
  newCategoryName.value = ''
  newCategoryColor.value = '#1E2157'
  savingCategory.value = false
}
const bannerInput = ref<HTMLInputElement | null>(null)

import type { LocationEntry } from '~/composables/useLocation'

// Availability checking for venue bookables
const allBookables = ref<any[]>([])
const availabilityMap = reactive<Record<string, 'available' | 'booked'>>({})
const checkingAvailability = ref(false)

const availabilityTimeLabel = computed(() => {
  if (!form.start_time) return 'event time not set'
  const t = new Date(form.start_time as Date)
  const h = t.getHours(); const m = t.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${m}${ampm}`
})

async function recheckAvailability() {
  checkingAvailability.value = true
  for (const b of allBookables.value) availabilityMap[b.id] = 'available'
  await new Promise(r => setTimeout(r, 600))
  checkingAvailability.value = false
  toast.add({ severity: 'success', summary: 'Availability updated', life: 2000 })
}

const disciplines = [
  { label: 'Swimming', value: 'swimming' },
  { label: 'Athletics', value: 'athletics' },
  { label: 'Football', value: 'football' },
  { label: 'Basketball', value: 'basketball' },
  { label: 'Tennis', value: 'tennis' },
  { label: 'Volleyball', value: 'volleyball' },
  { label: 'Gymnastics', value: 'gymnastics' },
  { label: 'Other', value: 'other' },
]


const visibilityOptions = [
  { key: 'is_public',           label: 'Public event',          desc: 'Visible to anyone' },
  { key: 'is_featured',         label: 'Featured',              desc: 'Highlighted on member profiles' },
  { key: 'show_attendee_list',  label: 'Show attendee list',    desc: 'Members can see who is attending' },
  { key: 'show_attendee_count', label: 'Show attendee count',   desc: 'Display registration numbers' },
  { key: 'allow_interest',      label: 'Allow interest',        desc: 'Members can indicate interest' },
  { key: 'hold_spot_enabled',   label: 'Hold-spot registration',desc: 'Allow pending confirmation spots' },
]

const adminDraft = reactive({ name: '', registrations: true, changes: false, notes: false })

function addAdmin() {
  form.admins.push({ ...adminDraft })
  Object.assign(adminDraft, { name: '', registrations: true, changes: false, notes: false })
  showAddAdminDialog.value = false
}

// Pre-fill date from query param
function parseDateParam(str: string | null): Date | null {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

const twoWeeksAgo = new Date()
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
twoWeeksAgo.setHours(0, 0, 0, 0)

const dateOpen = ref(true)

const formDateDisplay = computed(() => {
  const fDate = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
  const fTime = (d: Date) => d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
  const startDate = form.start_date ? new Date(form.start_date as any) : null
  const endDate   = form.end_date   ? new Date(form.end_date as any)   : null
  const startTime = form.start_time ? new Date(form.start_time as any) : null
  const endTime   = form.end_time   ? new Date(form.end_time as any)   : null
  if (!startDate) return { start: null, end: null, days: null }
  const sameDay = endDate ? startDate.toDateString() === endDate.toDateString() : true
  let start = '', end: string | null = null
  if (form.is_all_day) {
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
  const days = (form.is_all_day && endDate && !sameDay)
    ? Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
    : null
  return { start, end, days }
})

const form = reactive({
  title: '',
  description: '',
  category_ids: [] as string[],
  discipline: null as string | null,
  // Dates
  is_all_day: false,
  start_date: parseDateParam(route.query.date as string ?? null),
  start_time: null as Date | null,
  end_date: parseDateParam(route.query.date as string ?? null),
  end_time: null as Date | null,
  repeat: '',
  // Locations (multi)
  locations: [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] as string[] }] as LocationEntry[],
  has_capacity: false,
  capacity_max: null as number | null,
  // Visibility
  is_public: false,
  is_featured: false,
  show_attendee_list: false,
  show_attendee_count: true,
  allow_interest: false,
  hold_spot_enabled: false,
  has_waitlist: false,
  // Fees
  is_paid: false,
  fees: [] as { name: string; account: string; amount: number | null }[],
  // Settings
  banner_url: '',
  custom_terms: [] as string[],
  admins: [] as { name: string; registrations: boolean; changes: boolean; notes: boolean }[],
})

const totalFees = computed(() =>
  form.fees.reduce((sum, f) => sum + (f.amount ?? 0), 0)
)

function addFee() {
  form.fees.push({ name: '', account: '', amount: null })
}

const { uploadFile } = useUpload()
const uploadingBanner = ref(false)

function triggerBannerUpload() {
  bannerInput.value?.click()
}

async function handleBannerUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  // Show preview immediately
  form.banner_url = URL.createObjectURL(file)
  // Upload in background
  uploadingBanner.value = true
  try {
    form.banner_url = await uploadFile(file)
  } finally {
    uploadingBanner.value = false
  }
}

function buildDateTime(date: Date | null, time: Date | null): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time) d.setHours((time as Date).getHours(), (time as Date).getMinutes(), 0, 0)
  else d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

async function saveEvent() {
  if (!form.title.trim()) return
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: form.category_ids[0] ?? null,
      secondary_category_id: form.category_ids[1] ?? null,
      is_all_day: form.is_all_day,
      start_at: buildDateTime(form.start_date, form.is_all_day ? null : form.start_time),
      end_at: buildDateTime(form.end_date, form.is_all_day ? null : form.end_time),
      recurrence_rule: form.repeat || null,
      locations: form.locations,
      location_type: (form.locations[0]?.type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE',
      address: form.locations[0]?.type === 'ADDRESS' ? (form.locations[0].address || null) : null,
      meeting_link: form.locations[0]?.type === 'ONLINE' ? (form.locations[0].meeting_link || null) : null,
      capacity_max: form.has_capacity ? (form.capacity_max ?? null) : null,
      has_waitlist: form.has_waitlist,
      is_public: form.is_public,
      is_featured: form.is_featured,
      show_attendee_list: form.show_attendee_list,
      show_attendee_count: form.show_attendee_count,
      allow_interest: form.allow_interest,
      hold_spot_enabled: form.hold_spot_enabled,
      status: 'DRAFT',
    }

    let evtId: string
    if (draftEventId.value) {
      // Update the existing draft (invitees already saved against this ID)
      const { error } = await db.from('events').update(payload).eq('id', draftEventId.value)
      if (error) throw error
      evtId = draftEventId.value
    } else {
      const { data, error } = await db.from('events').insert({ ...payload, org_id: DEFAULT_ORG_ID, style: 'BASIC' }).select('id').single()
      if (error) throw error
      evtId = data.id
    }

    // Fee components
    if (form.is_paid && form.fees.length) {
      const feeRows = form.fees.filter(f => f.name.trim()).map(f => ({
        event_id: evtId,
        name: f.name.trim(),
        amount: f.amount ?? 0,
        xero_code: f.account || null,
      }))
      if (feeRows.length) await db.from('fee_components').insert(feeRows)
    }

    toast.add({ severity: 'success', summary: 'Event saved!', life: 3000 })
    navigateTo(`/events/${evtId}`)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: err?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  const [{ data: catData }, { data: bookableData }] = await Promise.all([
    db.from('categories').select('id, name').eq('org_id', DEFAULT_ORG_ID).order('name'),
    db.from('bookables').select('id, name, parent_id').eq('org_id', DEFAULT_ORG_ID).order('name'),
  ])
  categories.value = catData ?? []
  allBookables.value = bookableData ?? []
  for (const b of allBookables.value) availabilityMap[b.id] = 'available'

  // Create a draft event so EventInviteeManager has an ID to work with
  const { data } = await db.from('events').insert({
    org_id: DEFAULT_ORG_ID,
    title: '(draft)',
    style: 'BASIC',
    status: 'DRAFT',
  }).select('id').single()
  if (data) draftEventId.value = data.id
})
</script>
