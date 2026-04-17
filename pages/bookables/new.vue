<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- Steps indicator -->
    <div class="flex items-center mb-8">
      <div
        v-for="(step, i) in steps"
        :key="step.label"
        class="flex items-center"
        :class="i < steps.length - 1 ? 'flex-1' : ''"
      >
        <!-- Step item -->
        <div class="flex flex-col items-center gap-1.5 shrink-0">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm border"
            :class="
              currentStep === i + 1
                ? 'bg-[#EFF6FF] border-[#F3F4F6] text-[#1D4ED8] font-semibold'
                : currentStep > i + 1
                ? 'bg-[#1E2157] border-[#1E2157] text-white'
                : 'bg-white border-[#F3F4F6] text-gray-500'
            "
          >
            <i v-if="currentStep > i + 1" class="pi pi-check text-xs" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span
            class="text-xs whitespace-nowrap"
            :class="currentStep === i + 1 ? 'font-bold text-gray-600' : 'text-gray-400'"
          >{{ step.label }}</span>
        </div>
        <!-- Connector -->
        <div v-if="i < steps.length - 1" class="flex-1 h-px bg-[#DEE2E6] mx-2 mb-4" />
      </div>
    </div>

    <!-- Step content -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
      <!-- Step 1: Details -->
      <div v-if="currentStep === 1" class="p-6 flex flex-col gap-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Venue Details</h2>
          <p class="text-sm text-gray-500 mt-0.5">
            <template v-if="route.query.parentName">
              Creating a sub-venue under <strong>{{ route.query.parentName }}</strong>.
              Enter the details below.
            </template>
            <template v-else>
              Enter the information about the venue you would like people to be able to hire or you would like to be able to book.
            </template>
          </p>
        </div>

        <!-- Name -->
        <div class="flex items-center gap-4">
          <label class="w-48 text-sm text-gray-700 shrink-0">Name</label>
          <InputText v-model="form.name" placeholder="Enter the name of your venue" class="flex-1" />
        </div>

        <!-- Venue Level -->
        <div class="flex items-center gap-4">
          <label class="w-48 text-sm text-gray-700 shrink-0">Venue Level</label>
          <div class="flex items-center gap-3">
            <SelectButton
              v-model="form.venue_level"
              :options="venueLevelOptions"
              option-label="label"
              option-value="value"
              size="small"
            />
            <Select
              v-if="form.venue_level === 'AREA'"
              v-model="form.parent_id"
              :options="venueTree"
              option-label="label"
              option-value="id"
              placeholder="Choose Parent Venue"
              class="w-72"
            >
              <template #option="{ option }">
                <div class="flex items-center gap-1">
                  <span v-for="_ in option.depth" :key="_" class="text-gray-300 mr-0.5">›</span>
                  <i class="pi pi-building text-xs text-gray-400 mr-1" />
                  <span>{{ option.name }}</span>
                </div>
              </template>
            </Select>
          </div>
        </div>

        <!-- Max capacity -->
        <div class="flex items-center gap-4">
          <label class="w-48 text-sm text-gray-700 shrink-0">Max capacity of venue</label>
          <InputNumber v-model="form.max_concurrent" :min="0" class="w-28" />
        </div>

        <!-- Categories -->
        <div class="flex items-center gap-4">
          <label class="w-48 text-sm text-gray-700 shrink-0">Category</label>
          <div class="flex flex-1 items-center gap-2">
            <div class="flex-1 flex flex-wrap gap-1.5 min-h-[38px] border border-[#D1D5DB] rounded-md px-2.5 py-1.5 bg-white items-center">
              <span
                v-for="cat in selectedCategories"
                :key="cat"
                class="inline-flex items-center gap-1 bg-gray-200 text-gray-700 text-sm px-2.5 py-1 rounded-full"
              >
                {{ cat }}
                <button class="ml-0.5 text-gray-500 hover:text-gray-700" @click="removeCategory(cat)">
                  <i class="pi pi-times text-xs" />
                </button>
              </span>
              <InputText
                v-model="categoryInput"
                placeholder="Add category…"
                class="border-0 shadow-none p-0 h-6 text-sm flex-1 min-w-24"
                size="small"
                @keydown.enter.prevent="addCategory"
                @keydown.comma.prevent="addCategory"
              />
            </div>
          </div>
        </div>

        <!-- Address -->
        <div class="flex items-center gap-4">
          <label class="w-48 text-sm text-gray-700 shrink-0">Address</label>
          <InputText v-model="form.location" placeholder="123 Made up street" class="flex-1" />
        </div>

        <!-- Venue Info -->
        <div class="flex items-start gap-4">
          <label class="w-48 text-sm text-gray-700 shrink-0 pt-2">Venue Info</label>
          <div class="flex-1 flex flex-col gap-3">
            <!-- Tab menu -->
            <div class="flex border-b-2 border-gray-200">
              <button
                v-for="tab in infoTabs"
                :key="tab"
                class="px-4 py-2.5 text-sm font-bold border-b-2 -mb-0.5"
                :class="activeTab === tab
                  ? 'border-[#1E2157] text-[#3B82F6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'"
                @click="activeTab = tab"
              >{{ tab }}</button>
            </div>

            <!-- Load previous -->
            <div class="flex items-center gap-3 text-sm">
              <span class="text-gray-700">Load previous description</span>
              <Select
                v-model="loadFromVenue"
                :options="parentVenues"
                option-label="name"
                option-value="id"
                placeholder="Choose venue"
                class="w-52"
                @change="loadDescription"
              />
            </div>

            <!-- Editor -->
            <div class="border border-[#E5E7EB] rounded-md overflow-hidden">
              <div class="flex items-center gap-3 px-3 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                <button
                  v-for="tool in editorTools"
                  :key="tool.icon"
                  class="text-gray-500 hover:text-gray-700 p-0.5"
                  :title="tool.label"
                  @click="applyFormat(tool.cmd)"
                >
                  <i :class="`pi pi-${tool.icon} text-sm`" />
                </button>
              </div>
              <Textarea
                v-model="currentTabContent"
                :placeholder="`Describe your venue ${activeTab.toLowerCase()} here.`"
                rows="8"
                auto-resize
                class="border-0 rounded-none w-full resize-none p-3"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Photos -->
      <div v-if="currentStep === 2" class="p-6 flex flex-col gap-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Photos</h2>
          <p class="text-sm text-gray-500 mt-0.5">Add photos to help people identify and choose your venue.</p>
        </div>
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-12 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-[#1E2157] transition-colors"
          @click="triggerFileUpload"
        >
          <i class="pi pi-image text-4xl text-gray-300" />
          <div>
            <p class="text-sm font-medium text-gray-700">Click to upload photos</p>
            <p class="text-xs text-gray-400 mt-1">PNG, JPG, GIF up to 10MB</p>
          </div>
        </div>
        <div v-if="form.images.length" class="grid grid-cols-4 gap-3">
          <div
            v-for="(img, i) in form.images"
            :key="i"
            class="relative aspect-square rounded-lg overflow-hidden border border-gray-200"
          >
            <img :src="img.url" class="w-full h-full object-cover" />
            <button
              class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              @click="form.images.splice(i, 1)"
            >
              <i class="pi pi-times" />
            </button>
          </div>
        </div>
        <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="handleFileUpload" />
      </div>

      <!-- Step 3: Layout Options -->
      <div v-if="currentStep === 3" class="p-6 flex flex-col gap-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Layout Options</h2>
          <p class="text-sm text-gray-500 mt-0.5">Define the different layout configurations available for this venue.</p>
        </div>
        <div class="flex flex-col gap-3">
          <div
            v-for="(layout, i) in form.layouts"
            :key="i"
            class="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
          >
            <InputText v-model="layout.name" placeholder="Layout name (e.g. Theatre, Classroom)" class="flex-1" />
            <InputNumber v-model="layout.capacity" :min="0" placeholder="Capacity" class="w-32" />
            <Button icon="pi pi-trash" severity="danger" text size="small" @click="form.layouts.splice(i, 1)" />
          </div>
          <Button
            label="Add Layout"
            icon="pi pi-plus"
            severity="secondary"
            outlined
            size="small"
            class="self-start"
            @click="form.layouts.push({ name: '', capacity: null })"
          />
        </div>
      </div>

      <!-- Step 4: Booking Times -->
      <div v-if="currentStep === 4" class="p-6 flex flex-col gap-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Booking Times</h2>
          <p class="text-sm text-gray-500 mt-0.5">Set the times this venue is available for booking.</p>
        </div>
        <div class="flex flex-col gap-4">
          <div
            v-for="day in weekDays"
            :key="day.value"
            class="flex items-center gap-4"
          >
            <div class="w-28 flex items-center gap-2">
              <ToggleSwitch v-model="form.availability[day.value].enabled" size="small" />
              <span class="text-sm text-gray-700">{{ day.label }}</span>
            </div>
            <template v-if="form.availability[day.value].enabled">
              <DatePicker
                v-model="form.availability[day.value].open"
                time-only
                hour-format="12"
                placeholder="Open"
                class="w-36"
              />
              <span class="text-gray-400">—</span>
              <DatePicker
                v-model="form.availability[day.value].close"
                time-only
                hour-format="12"
                placeholder="Close"
                class="w-36"
              />
            </template>
            <span v-else class="text-sm text-gray-400 italic">Closed</span>
          </div>
        </div>
      </div>

      <!-- Step 5: Billing -->
      <div v-if="currentStep === 5" class="p-6 flex flex-col gap-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Billing</h2>
          <p class="text-sm text-gray-500 mt-0.5">Configure pricing and billing settings for this venue.</p>
        </div>
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-4">
            <label class="w-48 text-sm text-gray-700 shrink-0">Hourly Rate</label>
            <InputNumber v-model="form.billing.hourly_rate" mode="currency" currency="AUD" locale="en-AU" class="w-48" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-48 text-sm text-gray-700 shrink-0">Minimum Booking (hrs)</label>
            <InputNumber v-model="form.billing.min_hours" :min="0.5" :step="0.5" :min-fraction-digits="1" class="w-36" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-48 text-sm text-gray-700 shrink-0">Bond Amount</label>
            <InputNumber v-model="form.billing.bond" mode="currency" currency="AUD" locale="en-AU" class="w-48" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-48 text-sm text-gray-700 shrink-0">GST Applicable</label>
            <ToggleSwitch v-model="form.billing.gst" />
          </div>
          <div class="flex items-center gap-4">
            <label class="w-48 text-sm text-gray-700 shrink-0">Xero Account Code</label>
            <InputText v-model="form.billing.xero_code" placeholder="e.g. 200" class="w-48" />
          </div>
        </div>
      </div>

      <!-- Step 6: Communication -->
      <div v-if="currentStep === 6" class="p-6 flex flex-col gap-5">
        <div>
          <h2 class="text-lg font-semibold text-gray-900">Communication</h2>
          <p class="text-sm text-gray-500 mt-0.5">Set up automated communications for bookings at this venue.</p>
        </div>
        <div class="flex flex-col gap-4">
          <div class="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">Booking Confirmation</p>
              <p class="text-xs text-gray-500 mt-0.5">Sent when a booking is confirmed</p>
            </div>
            <ToggleSwitch v-model="form.comms.booking_confirmation" />
          </div>
          <div class="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">24h Reminder</p>
              <p class="text-xs text-gray-500 mt-0.5">Sent 24 hours before the booking</p>
            </div>
            <ToggleSwitch v-model="form.comms.reminder_24h" />
          </div>
          <div class="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">1h Reminder</p>
              <p class="text-xs text-gray-500 mt-0.5">Sent 1 hour before the booking</p>
            </div>
            <ToggleSwitch v-model="form.comms.reminder_1h" />
          </div>
          <div class="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-900">Post-booking Follow-up</p>
              <p class="text-xs text-gray-500 mt-0.5">Sent after the booking ends</p>
            </div>
            <ToggleSwitch v-model="form.comms.followup" />
          </div>
        </div>
      </div>
    </div>

    <!-- Footer nav -->
    <div class="flex items-center justify-between">
      <Button
        label="Cancel"
        severity="secondary"
        text
        @click="currentStep === 1 ? navigateTo('/bookables') : currentStep--"
      />
      <Button
        :label="currentStep === steps.length ? 'Create Venue' : `Next: ${steps[currentStep]?.label ?? ''}`"
        :loading="saving"
        :style="currentStep === steps.length ? 'background:#34B66D; border-color:#34B66D' : 'background:#1E2157; border-color:#1E2157'"
        :disabled="currentStep === 1 && !form.name.trim()"
        @click="nextStep"
      />
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const route = useRoute()
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000002'

const currentStep = ref(1)
const saving = ref(false)
const createdId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const categoryInput = ref('')
const activeTab = ref('Description')
const loadFromVenue = ref<string | null>(null)
const parentVenues = ref<any[]>([])

const steps = [
  { label: 'Details' },
  { label: 'Photos' },
  { label: 'Layout options' },
  { label: 'Booking Times' },
  { label: 'Billing' },
  { label: 'Communication' },
]

const venueLevelOptions = [
  { label: 'Venue', value: 'VENUE' },
  { label: 'Area', value: 'AREA' },
]

const infoTabs = ['Description', 'Features', 'Rules', 'Other']

const editorTools = [
  { icon: 'bold', label: 'Bold', cmd: 'bold' },
  { icon: 'italic', label: 'Italic', cmd: 'italic' },
  { icon: 'underline', label: 'Underline', cmd: 'underline' },
  { icon: 'align-left', label: 'Align Left', cmd: 'justifyLeft' },
  { icon: 'link', label: 'Link', cmd: 'link' },
]

const weekDays = [
  { label: 'Monday', value: 'mon' },
  { label: 'Tuesday', value: 'tue' },
  { label: 'Wednesday', value: 'wed' },
  { label: 'Thursday', value: 'thu' },
  { label: 'Friday', value: 'fri' },
  { label: 'Saturday', value: 'sat' },
  { label: 'Sunday', value: 'sun' },
]

const selectedCategories = ref<string[]>([])
const allVenues = ref<any[]>([])

// Build flat tree with depth for hierarchy display
const venueTree = computed(() => {
  const result: any[] = []
  function addNodes(parentId: string | null, depth: number) {
    const children = allVenues.value.filter(v => v.parent_id === parentId)
    for (const v of children) {
      result.push({ ...v, depth, label: v.name })
      addNodes(v.id, depth + 1)
    }
  }
  addNodes(null, 0)
  return result
})

const form = reactive({
  name: '',
  venue_level: 'VENUE',
  parent_id: null as string | null,
  max_concurrent: 0,
  location: '',
  description: '',
  features: '',
  rules: '',
  other_info: '',
  images: [] as any[],
  layouts: [] as any[],
  availability: Object.fromEntries(
    ['mon','tue','wed','thu','fri','sat','sun'].map(d => [d, { enabled: d !== 'sat' && d !== 'sun', open: null, close: null }])
  ),
  billing: {
    hourly_rate: null as number | null,
    min_hours: 1,
    bond: null as number | null,
    gst: true,
    xero_code: '',
  },
  comms: {
    booking_confirmation: true,
    reminder_24h: true,
    reminder_1h: false,
    followup: false,
  },
})

const currentTabContent = computed({
  get: () => {
    if (activeTab.value === 'Description') return form.description
    if (activeTab.value === 'Features') return form.features
    if (activeTab.value === 'Rules') return form.rules
    return form.other_info
  },
  set: (val: string) => {
    if (activeTab.value === 'Description') form.description = val
    else if (activeTab.value === 'Features') form.features = val
    else if (activeTab.value === 'Rules') form.rules = val
    else form.other_info = val
  },
})

function addCategory() {
  const v = categoryInput.value.trim().replace(/,$/, '')
  if (v && !selectedCategories.value.includes(v)) {
    selectedCategories.value.push(v)
  }
  categoryInput.value = ''
}

function removeCategory(cat: string) {
  selectedCategories.value = selectedCategories.value.filter(c => c !== cat)
}

function applyFormat(cmd: string) {
  // Rich text formatting is a placeholder in textarea mode
}

function triggerFileUpload() {
  fileInput.value?.click()
}

function handleFileUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    const url = URL.createObjectURL(file)
    form.images.push({ url, name: file.name })
  }
}

function loadDescription() {
  // Could load description from selected venue — no-op for now
}

async function loadParentVenues() {
  const { data } = await db
    .from('bookables')
    .select('id, name, parent_id')
    .eq('org_id', DEFAULT_ORG_ID)
    .eq('type', 'VENUE')
    .neq('status', 'DELETED')
    .order('name')
  allVenues.value = data ?? []
  parentVenues.value = data ?? []
}

async function saveVenue() {
  saving.value = true
  try {
    const payload: any = {
      org_id: DEFAULT_ORG_ID,
      name: form.name.trim(),
      type: 'VENUE',
      status: 'ACTIVE',
      parent_id: form.venue_level === 'AREA' ? (form.parent_id ?? (route.query.parentId as string ?? null)) : null,
      max_concurrent: form.max_concurrent || 1,
      location: form.location || null,
      description: form.description || null,
      features: form.features || null,
      rules: form.rules || null,
      sports: selectedCategories.value.length ? selectedCategories.value : null,
      custom_fields: {
        other_info: form.other_info || null,
        layouts: form.layouts.filter(l => l.name),
        availability: form.availability,
        billing: form.billing,
        comms: form.comms,
      },
      images: form.images.length ? form.images.map(img => ({ url: img.url, name: img.name })) : [],
    }
    if (createdId.value) {
      const { error } = await db.from('bookables').update(payload).eq('id', createdId.value)
      if (error) throw error
    } else {
      const { data, error } = await db.from('bookables').insert(payload).select().single()
      if (error) throw error
      createdId.value = data.id
    }
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: err?.message, life: 4000 })
    saving.value = false
    return false
  }
  saving.value = false
  return true
}

async function nextStep() {
  if (currentStep.value === steps.length) {
    const ok = await saveVenue()
    if (ok) {
      toast.add({ severity: 'success', summary: 'Venue created', life: 3000 })
      navigateTo('/bookables')
    }
    return
  }
  // Save on step 1 to get an ID
  if (currentStep.value === 1) {
    const ok = await saveVenue()
    if (!ok) return
  }
  currentStep.value++
}

onMounted(async () => {
  await loadParentVenues()
  // Pre-fill parent from query param (Add Sub-venue flow)
  if (route.query.parentId) {
    form.venue_level = 'AREA'
    form.parent_id = route.query.parentId as string
  }
})
</script>
