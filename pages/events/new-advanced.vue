<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">

    <!-- Step progress header -->
    <div class="bg-white border-b border-gray-200 shrink-0">
      <!-- Top bar: cancel + title + save-draft -->
      <div class="flex items-center justify-between px-4 md:px-6 py-3">
        <button class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors" @click="navigateTo('/events')">
          <i class="pi pi-times text-xs" />
          <span class="hidden sm:inline">Cancel</span>
        </button>
        <span class="text-sm font-semibold text-gray-800">Create Advanced Event</span>
        <button class="text-sm text-[#1E2157] hover:underline font-medium" @click="saveDraft">
          <span class="hidden sm:inline">Save draft</span>
          <i class="pi pi-bookmark sm:hidden" />
        </button>
      </div>

      <!-- Step indicators -->
      <div class="flex items-center px-4 md:px-6 pb-4 gap-0 overflow-x-auto">
        <template v-for="(step, idx) in steps" :key="idx">
          <div class="flex items-center gap-2 shrink-0 cursor-pointer" @click="idx < currentStep && (currentStep = idx)">
            <!-- Circle -->
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all"
              :class="idx < currentStep
                ? 'bg-[#1E2157] text-white'
                : idx === currentStep
                  ? 'bg-[#1E2157] text-white ring-4 ring-[#1E2157]/20'
                  : 'bg-gray-100 text-gray-400'">
              <i v-if="idx < currentStep" class="pi pi-check text-[10px]" />
              <span v-else>{{ idx + 1 }}</span>
            </div>
            <!-- Label -->
            <span class="text-xs font-medium whitespace-nowrap hidden sm:inline"
              :class="idx <= currentStep ? 'text-gray-800' : 'text-gray-400'">
              {{ step.label }}
            </span>
          </div>
          <!-- Connector line -->
          <div v-if="idx < steps.length - 1" class="flex-1 min-w-[16px] h-px mx-2 shrink-0"
            :class="idx < currentStep ? 'bg-[#1E2157]' : 'bg-gray-200'" />
        </template>
      </div>
    </div>

    <!-- Step content (scrollable) -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

        <!-- Step 0: Event Info -->
        <template v-if="currentStep === 0">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Event Information</h2>
            <p class="text-sm text-gray-500">Give your event a name and describe what it's about.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div class="px-5 py-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Event Title <span class="text-red-400">*</span></label>
              <InputText v-model="form.title" placeholder="e.g. Club Championships 2025" class="w-full" autofocus />
            </div>
            <div class="px-5 py-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <RichTextEditor v-model="form.description" placeholder="Describe your event — schedule, what to bring, who it's for…" />
            </div>
            <div class="px-5 py-4 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <div class="flex items-center gap-2">
                  <MultiSelect v-model="form.category_ids" :options="categories" option-label="name" option-value="id"
                    placeholder="Choose categories" class="flex-1" display="chip">
                    <template #chip="{ value }">
                      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                        :style="{ background: categories.find(c => c.id === value)?.color ?? '#1E2157' }">
                        {{ categories.find(c => c.id === value)?.name }}
                      </div>
                    </template>
                  </MultiSelect>
                  <Button icon="pi pi-plus" size="small" severity="secondary" outlined v-tooltip.top="'New category'" @click="showNewCategoryDialog = true" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Discipline</label>
                <Select v-model="form.discipline" :options="disciplines" option-label="label" option-value="value"
                  placeholder="Choose discipline" show-clear class="w-full" />
              </div>
            </div>
            <div class="px-5 py-4">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Banner Image</label>
              <p class="text-xs text-gray-400 mb-3">1200 × 350 recommended</p>
              <div v-if="!form.banner_url"
                class="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-[#1E2157] transition-colors cursor-pointer"
                @click="bannerInput?.click()">
                <i class="pi pi-image text-3xl text-gray-300" />
                <Button label="Upload banner" severity="secondary" outlined size="small" icon="pi pi-upload" />
              </div>
              <div v-else class="relative rounded-xl overflow-hidden">
                <img :src="form.banner_url" class="w-full h-36 object-cover" />
                <div v-if="uploadingBanner" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <i class="pi pi-spin pi-spinner text-white text-xl" />
                </div>
                <Button v-else icon="pi pi-times" severity="danger" rounded size="small" class="absolute top-2 right-2" @click="form.banner_url = ''" />
              </div>
              <input ref="bannerInput" type="file" accept="image/*" class="hidden" @change="handleBannerUpload" />
            </div>
          </div>
        </template>

        <!-- Step 1: Date & Time -->
        <template v-if="currentStep === 1">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Date &amp; Time</h2>
            <p class="text-sm text-gray-500">When does your event start and end?</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <DateTimeEditor
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
        </template>

        <!-- Step 2: Location -->
        <template v-if="currentStep === 2">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Location</h2>
            <p class="text-sm text-gray-500">Where will the event take place?</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <LocationEditor v-model="form.locations" :availabilityMap="availabilityMap" />
          </div>
        </template>

        <!-- Step 3: Capacity & Sign Up -->
        <template v-if="currentStep === 3">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Capacity &amp; Sign Up</h2>
            <p class="text-sm text-gray-500">Control how many people can register and when.</p>
          </div>

          <!-- Capacity -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Capacity</h3>
            <div class="flex items-center gap-3">
              <ToggleSwitch v-model="form.has_capacity" />
              <span class="text-sm text-gray-600">{{ form.has_capacity ? 'Limited capacity' : 'No capacity limit' }}</span>
            </div>
            <div v-if="form.has_capacity" class="flex items-center gap-3">
              <InputNumber v-model="form.capacity_max" placeholder="Max attendees" class="w-48" :min="1" />
              <span class="text-sm text-gray-500">spots maximum</span>
            </div>
            <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
              <ToggleSwitch v-model="form.has_waitlist" />
              <div>
                <p class="text-sm text-gray-700">Enable waitlist</p>
                <p class="text-xs text-gray-400">Overflow registrations join a waitlist</p>
              </div>
            </div>
            <div class="flex items-center gap-3 pt-3 border-t border-gray-100">
              <ToggleSwitch v-model="form.allow_guests" />
              <div>
                <p class="text-sm text-gray-700">Allow guests</p>
                <p class="text-xs text-gray-400">Non-members can register</p>
              </div>
            </div>
          </div>

          <!-- Sign Up Window -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Sign Up Window</h3>
            <p class="text-xs text-gray-500">Leave blank to allow sign-ups at any time.</p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Opens</label>
                <DatePicker v-model="form.reg_open_at" show-icon show-time hour-format="12" date-format="dd/mm/yy" class="w-full" placeholder="No open date" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Closes</label>
                <DatePicker v-model="form.reg_close_at" show-icon show-time hour-format="12" date-format="dd/mm/yy" class="w-full" placeholder="No close date" />
              </div>
            </div>
          </div>

          <!-- Phased registration -->
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 class="text-sm font-semibold text-gray-700">Phased Registration</h3>
            <div class="flex items-center gap-3">
              <ToggleSwitch v-model="form.phased_registration" />
              <div>
                <p class="text-sm text-gray-700">Member early access</p>
                <p class="text-xs text-gray-400">Members get a head start before public registration opens</p>
              </div>
            </div>
            <div v-if="form.phased_registration" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Member window (days)</label>
                <InputNumber v-model="form.member_window_days" :min="1" :max="365" class="w-full" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Public opens at</label>
                <DatePicker v-model="form.public_opens_at" show-icon show-time hour-format="12" date-format="dd/mm/yy" class="w-full" placeholder="Public open date" />
              </div>
            </div>
          </div>
        </template>

        <!-- Step 4: Visibility & Permissions -->
        <template v-if="currentStep === 4">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Visibility &amp; Permissions</h2>
            <p class="text-sm text-gray-500">Control who can see and interact with this event.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div v-for="opt in visibilityOptions" :key="opt.key" class="flex items-center gap-4 px-5 py-4">
              <div class="flex-1">
                <p class="text-sm font-medium text-gray-700">{{ opt.label }}</p>
                <p class="text-xs text-gray-400 mt-0.5">{{ opt.desc }}</p>
              </div>
              <ToggleSwitch v-model="form[opt.key]" />
            </div>
          </div>
        </template>

        <!-- Step 5: Fees -->
        <template v-if="currentStep === 5">
          <div>
            <h2 class="text-lg font-bold text-gray-900 mb-1">Fees</h2>
            <p class="text-sm text-gray-500">Set up registration fees if this event is ticketed or charged.</p>
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-700">Are attendees charged?</p>
                <p class="text-xs text-gray-400 mt-0.5">Enable to add fee components</p>
              </div>
              <div class="flex">
                <button class="px-4 py-2 text-sm font-medium border rounded-l-lg transition-colors"
                  :class="!form.is_paid ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'"
                  @click="form.is_paid = false">Free</button>
                <button class="px-4 py-2 text-sm font-medium border rounded-r-lg transition-colors"
                  :class="form.is_paid ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'"
                  @click="form.is_paid = true">Charged</button>
              </div>
            </div>
            <template v-if="form.is_paid">
              <div class="border border-gray-200 rounded-xl overflow-hidden">
                <!-- Desktop header row -->
                <div class="hidden sm:grid px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  style="grid-template-columns:2fr 2fr 1fr 40px">
                  <span>Fee Name</span><span>Account</span><span>Amount</span><span />
                </div>
                <!-- Desktop rows -->
                <div v-for="(fee, idx) in form.fees" :key="idx"
                  class="border-b border-gray-100">
                  <!-- Desktop layout -->
                  <div class="hidden sm:grid px-4 py-2.5 items-center gap-3"
                    style="grid-template-columns:2fr 2fr 1fr 40px">
                    <InputText v-model="fee.name" placeholder="e.g. Entry Fee" size="small" class="w-full" />
                    <InputText v-model="fee.account" placeholder="e.g. 531 - Events" size="small" class="w-full" />
                    <InputNumber v-model="fee.amount" mode="currency" currency="AUD" locale="en-AU" size="small" class="w-full" input-class="text-right" />
                    <Button icon="pi pi-trash" text severity="danger" size="small" @click="form.fees.splice(idx, 1)" />
                  </div>
                  <!-- Mobile layout -->
                  <div class="sm:hidden px-4 py-3 space-y-2">
                    <div class="flex items-center gap-2">
                      <InputText v-model="fee.name" placeholder="Fee name" size="small" class="flex-1" />
                      <Button icon="pi pi-trash" text severity="danger" size="small" @click="form.fees.splice(idx, 1)" />
                    </div>
                    <InputText v-model="fee.account" placeholder="Account" size="small" class="w-full" />
                    <InputNumber v-model="fee.amount" mode="currency" currency="AUD" locale="en-AU" size="small" class="w-full" input-class="text-right" placeholder="Amount" />
                  </div>
                </div>
                <div class="hidden sm:grid px-4 py-2.5 border-b border-gray-200 font-semibold text-sm"
                  style="grid-template-columns:2fr 2fr 1fr 40px">
                  <span class="text-gray-700">Total</span><span /><span class="text-gray-900">${{ totalFees.toFixed(2) }}</span><span />
                </div>
                <div class="sm:hidden px-4 py-2.5 border-b border-gray-200 flex justify-between text-sm font-semibold">
                  <span class="text-gray-700">Total</span>
                  <span class="text-gray-900">${{ totalFees.toFixed(2) }}</span>
                </div>
                <div class="px-4 py-2.5">
                  <Button icon="pi pi-plus" label="Add Fee" size="small" severity="secondary" text @click="addFee" />
                </div>
              </div>
              <div class="flex items-center gap-3 pt-2">
                <ToggleSwitch v-model="form.has_tickets" />
                <div>
                  <p class="text-sm text-gray-700">Enable ticketing</p>
                  <p class="text-xs text-gray-400">Set up ticket types and quantities after creation</p>
                </div>
              </div>
            </template>
          </div>
        </template>

        <div class="h-2" />
      </div>
    </div>

    <!-- Bottom navigation -->
    <div class="bg-white border-t border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
      <Button
        v-if="currentStep > 0"
        label="Back"
        icon="pi pi-chevron-left"
        severity="secondary"
        outlined
        @click="currentStep--; scrollTop()"
      />
      <div v-else />
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-400">{{ currentStep + 1 }} / {{ steps.length }}</span>
        <Button
          v-if="currentStep < steps.length - 1"
          label="Next"
          icon="pi pi-chevron-right"
          icon-pos="right"
          :disabled="currentStep === 0 && !form.title.trim()"
          style="background:#1E2157; border-color:#1E2157"
          @click="currentStep++; scrollTop()"
        />
        <Button
          v-else
          label="Create Event"
          icon="pi pi-check"
          :loading="saving"
          :disabled="!form.title.trim()"
          style="background:#34B66D; border-color:#34B66D"
          @click="saveEvent"
        />
      </div>
    </div>
  </div>

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
          <button v-for="color in colorPalette" :key="color"
            class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            :class="newCategoryColor === color ? 'border-gray-900 scale-110' : 'border-transparent'"
            :style="{ background: color }"
            @click="newCategoryColor = color" />
        </div>
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="showNewCategoryDialog = false" />
      <Button label="Create" :disabled="!newCategoryName.trim()" :loading="savingCategory" @click="createCategory"
        style="background:#1E2157; border-color:#1E2157" />
    </template>
  </Dialog>

  <Toast />
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'
import type { LocationEntry } from '~/composables/useLocation'

definePageMeta({ layout: 'default' })

const db = useDb()
const toast = useToast()
const route = useRoute()

const saving = ref(false)
const currentStep = ref(0)

const steps = [
  { label: 'Event Info' },
  { label: 'Date & Time' },
  { label: 'Location' },
  { label: 'Capacity & Sign Up' },
  { label: 'Visibility' },
  { label: 'Fees' },
]

function scrollTop() {
  nextTick(() => document.querySelector('.overflow-y-auto')?.scrollTo(0, 0))
}

// ── Form ──────────────────────────────────────────────────────────────────
const twoWeeksAgo = new Date()
twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
twoWeeksAgo.setHours(0, 0, 0, 0)

function parseDateParam(str: string | null): Date | null {
  if (!str) return null
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

const form = reactive({
  title: (route.query.name as string) ?? '',
  description: '',
  category_ids: [] as string[],
  discipline: null as string | null,
  banner_url: '',
  // Date
  is_all_day: false,
  start_date: parseDateParam(route.query.date as string ?? null),
  start_time: null as Date | null,
  end_date: parseDateParam(route.query.date as string ?? null),
  end_time: null as Date | null,
  repeat: '',
  // Location
  locations: [{ type: 'ADDRESS', venue_name: '', address: '', meeting_link: '', bookable_ids: [] as string[] }] as LocationEntry[],
  // Capacity
  has_capacity: false,
  capacity_max: null as number | null,
  has_waitlist: false,
  allow_guests: false,
  // Sign up
  reg_open_at: null as Date | null,
  reg_close_at: null as Date | null,
  // Phased
  phased_registration: false,
  member_window_days: 40,
  public_opens_at: null as Date | null,
  // Visibility
  is_public: false,
  is_featured: false,
  show_attendee_list: false,
  show_attendee_count: true,
  allow_interest: false,
  hold_spot_enabled: false,
  // Fees
  is_paid: false,
  has_tickets: false,
  fees: [] as { name: string; account: string; amount: number | null }[],
})

const visibilityOptions = [
  { key: 'is_public',           label: 'Public event',          desc: 'Visible to non-members' },
  { key: 'is_featured',         label: 'Featured',              desc: 'Highlighted in event lists' },
  { key: 'show_attendee_list',  label: 'Show attendee list',    desc: 'Members can see who is attending' },
  { key: 'show_attendee_count', label: 'Show attendee count',   desc: 'Display total registration numbers' },
  { key: 'allow_interest',      label: 'Allow interest',        desc: 'Members can express interest before registration opens' },
  { key: 'hold_spot_enabled',   label: 'Hold-spot registration',desc: 'Members can hold a spot pending confirmation' },
]

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

const totalFees = computed(() => form.fees.reduce((sum, f) => sum + (f.amount ?? 0), 0))

function addFee() {
  form.fees.push({ name: '', account: '', amount: null })
}

// ── Categories ────────────────────────────────────────────────────────────
const categories = ref<any[]>([])
const showNewCategoryDialog = ref(false)
const newCategoryName = ref('')
const newCategoryColor = ref('#1E2157')
const savingCategory = ref(false)
const colorPalette = ['#1E2157','#3B82F6','#8B5CF6','#EC4899','#EF4444','#F59E0B','#10B981','#06B6D4','#6B7280','#1EA97C','#F97316','#84CC16']

async function createCategory() {
  if (!newCategoryName.value.trim()) return
  savingCategory.value = true
  const { data, error } = await db.from('categories').insert({
    org_id: orgId.value, name: newCategoryName.value.trim(), color: newCategoryColor.value,
  }).select('id, name, color').single()
  if (!error && data) {
    categories.value.push(data)
    form.category_ids.push(data.id)
  }
  showNewCategoryDialog.value = false
  newCategoryName.value = ''
  newCategoryColor.value = '#1E2157'
  savingCategory.value = false
}

// ── Banner ────────────────────────────────────────────────────────────────
const bannerInput = ref<HTMLInputElement | null>(null)
const uploadingBanner = ref(false)
const { uploadFile } = useUpload()

async function handleBannerUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  form.banner_url = URL.createObjectURL(file)
  uploadingBanner.value = true
  try { form.banner_url = await uploadFile(file) } finally { uploadingBanner.value = false }
}

// ── Availability ──────────────────────────────────────────────────────────
const availabilityMap = reactive<Record<string, 'available' | 'booked'>>({})

// ── Save ──────────────────────────────────────────────────────────────────
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
    const { data, error } = await db.from('events').insert({
      org_id: orgId.value,
      style: 'ADVANCED',
      status: 'DRAFT',
      title: form.title.trim(),
      description: form.description.trim() || null,
      category_id: form.category_ids[0] ?? null,
      secondary_category_id: form.category_ids[1] ?? null,
      banner_url: form.banner_url || null,
      is_all_day: form.is_all_day,
      start_at: buildDateTime(form.start_date, form.is_all_day ? null : form.start_time),
      end_at: buildDateTime(form.end_date, form.is_all_day ? null : form.end_time),
      recurrence_rule: form.repeat || null,
      locations: form.locations,
      location_type: (form.locations[0]?.type ?? 'ADDRESS') as 'ADDRESS' | 'ONLINE' | 'BOOKABLE',
      address: form.locations[0]?.type === 'ADDRESS' ? (form.locations[0].address || null) : null,
      meeting_link: form.locations[0]?.type === 'ONLINE' ? (form.locations[0].meeting_link || null) : null,
      has_capacity: form.has_capacity,
      capacity_max: form.has_capacity ? (form.capacity_max ?? null) : null,
      has_waitlist: form.has_waitlist,
      allow_guests: form.allow_guests,
      reg_open_at: form.reg_open_at ?? null,
      reg_close_at: form.reg_close_at ?? null,
      phased_registration: form.phased_registration,
      member_window_days: form.member_window_days,
      public_opens_at: form.public_opens_at ?? null,
      is_public: form.is_public,
      is_featured: form.is_featured,
      show_attendee_list: form.show_attendee_list,
      show_attendee_count: form.show_attendee_count,
      allow_interest: form.allow_interest,
      hold_spot_enabled: form.hold_spot_enabled,
    }).select('id').single()
    if (error) throw error

    if (form.is_paid && form.fees.length) {
      const rows = form.fees.filter(f => f.name.trim()).map(f => ({
        event_id: data.id, name: f.name.trim(), amount: f.amount ?? 0, xero_code: f.account || null,
      }))
      if (rows.length) await db.from('fee_components').insert(rows)
    }

    toast.add({ severity: 'success', summary: 'Event created!', life: 3000 })
    navigateTo(`/events/${data.id}`)
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Could not create event', detail: err?.message, life: 4000 })
  } finally {
    saving.value = false
  }
}

async function saveDraft() {
  if (!form.title.trim()) {
    toast.add({ severity: 'warn', summary: 'Enter a title first', life: 2000 })
    return
  }
  await saveEvent()
}

// ── Mount ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  const [{ data: catData }, { data: bookableData }] = await Promise.all([
    db.from('categories').select('id, name, color').eq('org_id', orgId.value).order('name'),
    db.from('bookables').select('id, name').eq('org_id', orgId.value).order('name'),
  ])
  categories.value = catData ?? []
  for (const b of (bookableData ?? [])) availabilityMap[b.id] = 'available'
})
</script>
