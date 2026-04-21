<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">

    <!-- Top bar -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
      <button class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        @click="navigateTo('/bookables')">
        <i class="pi pi-times text-xs" />
        <span class="hidden sm:inline">Cancel</span>
      </button>
      <span class="text-sm font-semibold text-gray-800">Create Venue</span>
      <div class="w-16" />
    </div>

    <!-- Step indicators -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 shrink-0 overflow-x-auto">
      <div class="flex items-center min-w-max mx-auto">
        <template v-for="(step, i) in steps" :key="step.key">
          <div class="flex flex-col items-center gap-1 shrink-0">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 transition-all"
              :class="currentStep > i + 1
                ? 'bg-[#1E2157] border-[#1E2157] text-white'
                : currentStep === i + 1
                ? 'bg-white border-[#1E2157] text-[#1E2157] font-semibold'
                : 'bg-white border-gray-200 text-gray-400'">
              <i v-if="currentStep > i + 1" class="pi pi-check text-[10px]" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="hidden sm:inline text-[10px] whitespace-nowrap font-medium"
              :class="currentStep === i + 1 ? 'text-[#1E2157]' : currentStep > i + 1 ? 'text-gray-500' : 'text-gray-300'">
              {{ step.label }}
            </span>
          </div>
          <div v-if="i < steps.length - 1" class="w-10 md:w-16 h-px mx-1 mb-3 sm:mb-0 transition-colors shrink-0"
            :class="currentStep > i + 1 ? 'bg-[#1E2157]' : 'bg-gray-200'" />
        </template>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

        <!-- ── Step 1: Details ── -->
        <template v-if="currentStep === 1">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Venue details</h2>
            <p class="text-sm text-gray-500 mt-1">
              <template v-if="route.query.parentName">
                Creating a sub-venue under <strong>{{ route.query.parentName }}</strong>.
              </template>
              <template v-else>
                Basic information about the venue people will be able to book.
              </template>
            </p>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Name <span class="text-red-400">*</span></label>
              <InputText v-model="form.name" placeholder="e.g. Main Hall, Field 1" class="flex-1" />
            </div>

            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Type</label>
              <div class="flex gap-2">
                <button v-for="opt in venueLevelOptions" :key="opt.value"
                  class="px-4 py-1.5 rounded-full text-sm border transition-colors"
                  :class="form.venue_level === opt.value
                    ? 'bg-[#1E2157] border-[#1E2157] text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'"
                  @click="form.venue_level = opt.value">
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <div v-if="form.venue_level === 'AREA'" class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Parent venue</label>
              <Select v-model="form.parent_id" :options="venueTree" option-label="label" option-value="id"
                placeholder="Choose parent" class="flex-1">
                <template #option="{ option }">
                  <div class="flex items-center gap-1">
                    <span v-for="_ in option.depth" :key="_" class="text-gray-300 mr-0.5">›</span>
                    {{ option.name }}
                  </div>
                </template>
              </Select>
            </div>

            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Max capacity</label>
              <InputNumber v-model="form.max_concurrent" :min="0" class="w-28" />
            </div>

            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Address / location</label>
              <InputText v-model="form.location" placeholder="123 Main Street" class="flex-1" />
            </div>

            <div class="flex items-start gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0 pt-1">Description</label>
              <Textarea v-model="form.description" placeholder="Describe the venue…" auto-resize rows="4" class="flex-1 text-sm" />
            </div>

            <div class="flex items-start gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0 pt-1">Categories</label>
              <div class="flex-1 flex flex-col gap-2">
                <!-- Existing categories to select -->
                <div v-if="existingSports.length" class="flex flex-wrap gap-1.5">
                  <button v-for="sport in existingSports" :key="sport"
                    type="button"
                    class="px-2.5 py-1 rounded-full text-xs border transition-colors"
                    :class="selectedCategories.includes(sport)
                      ? 'bg-[#1E2157] border-[#1E2157] text-white'
                      : 'border-gray-200 text-gray-600 hover:border-[#1E2157] hover:text-[#1E2157]'"
                    @click="toggleCategory(sport)">
                    {{ sport }}
                  </button>
                </div>
                <!-- Selected tags + add new input -->
                <div class="flex flex-wrap gap-1.5 min-h-[38px] border border-gray-300 rounded-md px-2.5 py-1.5 bg-white items-center">
                  <span v-for="cat in selectedCategories" :key="cat"
                    class="inline-flex items-center gap-1 bg-[#1E2157] text-white text-xs px-2.5 py-0.5 rounded-full">
                    {{ cat }}
                    <button type="button" @click="selectedCategories = selectedCategories.filter(c => c !== cat)">
                      <i class="pi pi-times text-[8px]" />
                    </button>
                  </span>
                  <InputText v-model="categoryInput" placeholder="Type to add new…"
                    class="border-0 shadow-none p-0 h-6 text-sm flex-1 min-w-28" size="small"
                    @keydown.enter.prevent="addCategory" @keydown.comma.prevent="addCategory" />
                </div>
                <p v-if="existingSports.length" class="text-xs text-gray-400">Click a category to select it, or type to add a new one</p>
              </div>
            </div>
          </div>
        </template>

        <!-- ── Step 2: Photos ── -->
        <template v-else-if="currentStep === 2">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Photos</h2>
            <p class="text-sm text-gray-500 mt-1">Add photos to help people identify and choose this venue. You can add more later.</p>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
            <div class="border-2 border-dashed border-gray-300 rounded-xl p-12 flex flex-col items-center gap-3 text-center cursor-pointer hover:border-[#1E2157] transition-colors"
              @click="fileInput?.click()">
              <i class="pi pi-image text-4xl text-gray-300" />
              <div>
                <p class="text-sm font-medium text-gray-700">Click to upload photos</p>
                <p class="text-xs text-gray-400 mt-1">PNG, JPG up to 10 MB each</p>
              </div>
            </div>
            <div v-if="form.images.length" class="grid grid-cols-3 sm:grid-cols-4 gap-3">
              <div v-for="(img, i) in form.images" :key="i"
                class="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                <img :src="img.url" class="w-full h-full object-cover" />
                <button class="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
                  @click="form.images.splice(i, 1)">
                  <i class="pi pi-times text-[10px]" />
                </button>
              </div>
            </div>
            <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="handleFileUpload" />
          </div>
        </template>

        <!-- ── Step 3: Layouts ── -->
        <template v-else-if="currentStep === 3">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Layout options</h2>
            <p class="text-sm text-gray-500 mt-1">Define the different configurations this venue can be set up in.</p>
          </div>

          <div class="flex flex-col gap-4">
            <div v-for="(layout, li) in form.layouts" :key="li"
              class="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div class="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <i class="pi pi-th-large text-gray-400 text-sm" />
                <InputText v-model="layout.name" placeholder="Layout name (e.g. Full Field, Classroom)" class="flex-1 text-sm font-medium" size="small" />
                <button class="text-gray-300 hover:text-red-500 transition-colors" @click="form.layouts.splice(li, 1)">
                  <i class="pi pi-trash text-sm" />
                </button>
              </div>
              <div class="border-t border-gray-100">
                <div class="px-4 py-2.5 flex items-center justify-between">
                  <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Modes</p>
                  <button type="button"
                    class="flex items-center gap-1 text-xs text-[#1E2157] hover:underline"
                    @click="layout.modes.push({ name: '', description: '', min_players: null, max_players: null, price: 0, price_type: 'INCLUDED' })">
                    <i class="pi pi-plus text-[10px]" /> Add mode
                  </button>
                </div>
                <div v-if="!layout.modes.length" class="px-4 pb-3 text-xs text-gray-400 italic">
                  No modes yet — e.g. Playing, Practicing, Tournament
                </div>
                <div class="divide-y divide-gray-50">
                  <div v-for="(mode, mi) in layout.modes" :key="mi" class="px-4 py-3 flex flex-col gap-3">
                    <div class="flex items-center gap-2">
                      <div class="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <i class="pi pi-tag text-[9px] text-indigo-600" />
                      </div>
                      <InputText v-model="mode.name" placeholder="Mode name (e.g. Playing, Tournament)"
                        class="flex-1 text-sm font-medium" size="small" />
                      <button type="button" class="text-gray-300 hover:text-red-500 transition-colors"
                        @click="layout.modes.splice(mi, 1)">
                        <i class="pi pi-times text-xs" />
                      </button>
                    </div>
                    <div class="ml-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div class="flex flex-col gap-1">
                        <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Min players</label>
                        <InputNumber v-model="mode.min_players" :min="0" placeholder="—" class="w-full" size="small" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Max players</label>
                        <InputNumber v-model="mode.max_players" :min="0" placeholder="—" class="w-full" size="small" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Pricing</label>
                        <Select v-model="mode.price_type" :options="modePriceTypes" option-label="label" option-value="value"
                          class="w-full text-sm" size="small" />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                          {{ mode.price_type === 'PER_HOUR' ? 'Per hour' : mode.price_type === 'PER_PERSON' ? 'Per person' : 'Amount' }}
                        </label>
                        <InputNumber v-if="!['FREE','INCLUDED'].includes(mode.price_type)"
                          v-model="mode.price" mode="currency" currency="GBP" locale="en-GB"
                          class="w-full text-sm" size="small" />
                        <span v-else class="text-xs text-gray-400 italic pt-2">
                          {{ mode.price_type === 'FREE' ? 'No charge' : 'Uses layout price' }}
                        </span>
                      </div>
                      <div class="col-span-full flex flex-col gap-1">
                        <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Description (optional)</label>
                        <InputText v-model="mode.description" placeholder="Short description of this mode…"
                          class="w-full text-sm" size="small" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button class="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#1E2157] hover:text-[#1E2157] transition-colors bg-white"
              @click="form.layouts.push({ name: '', modes: [] as any[] })">
              <i class="pi pi-plus text-xs" />
              Add layout
            </button>
          </div>
        </template>

        <!-- ── Step 4: Booking Windows ── -->
        <template v-else-if="currentStep === 4">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Booking windows</h2>
            <p class="text-sm text-gray-500 mt-1">Define when this venue can be booked and how slots are structured. You can set up multiple windows for different times of day.</p>
          </div>

          <div class="flex flex-col gap-4">
            <div v-for="(win, wi) in form.windows" :key="wi"
              class="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div class="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                <span class="text-sm font-medium text-gray-700 flex-1">Window {{ wi + 1 }}</span>
                <div class="flex gap-1">
                  <button v-for="t in windowTypes" :key="t.value"
                    class="px-2.5 py-1 rounded-md text-xs border transition-colors"
                    :class="win.window_type === t.value
                      ? 'bg-[#1E2157] border-[#1E2157] text-white'
                      : 'border-gray-200 text-gray-500 hover:border-gray-400'"
                    @click="win.window_type = t.value">
                    {{ t.label }}
                  </button>
                </div>
                <button class="text-gray-300 hover:text-red-500 transition-colors ml-2" @click="form.windows.splice(wi, 1)">
                  <i class="pi pi-trash text-sm" />
                </button>
              </div>

              <div class="p-4 flex flex-col gap-4">
                <div class="flex items-center gap-3">
                  <span class="text-sm text-gray-600 w-32 shrink-0">Days</span>
                  <div class="flex gap-1.5 flex-wrap">
                    <button v-for="d in weekDays" :key="d.value"
                      class="w-8 h-8 rounded-full text-xs font-medium border transition-colors"
                      :class="win.days.includes(d.value)
                        ? 'bg-[#1E2157] border-[#1E2157] text-white'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400'"
                      @click="toggleDay(win, d.value)">
                      {{ d.short }}
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-3 flex-wrap">
                  <span class="text-sm text-gray-600 w-32 shrink-0">Time range</span>
                  <Select v-model="win.start_time" :options="timeOptions" option-label="label" option-value="value"
                    class="w-32" size="small" placeholder="Start" />
                  <span class="text-gray-400 text-sm">to</span>
                  <Select v-model="win.end_time" :options="timeOptions" option-label="label" option-value="value"
                    class="w-32" size="small" placeholder="End" />
                </div>

                <div v-if="win.window_type !== 'FIXED'" class="flex items-center gap-3">
                  <span class="text-sm text-gray-600 w-32 shrink-0">Slot duration</span>
                  <Select v-model="win.slot_duration_mins" :options="durationOptions" option-label="label" option-value="value"
                    class="w-40" size="small" />
                </div>

                <div class="flex items-center gap-3">
                  <span class="text-sm text-gray-600 w-32 shrink-0">Capacity</span>
                  <InputNumber v-model="win.capacity" :min="1" class="w-24" size="small" />
                </div>
              </div>
            </div>

            <button class="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-[#1E2157] hover:text-[#1E2157] transition-colors bg-white"
              @click="addWindow">
              <i class="pi pi-plus text-xs" />
              Add booking window
            </button>

            <div v-if="!form.windows.length" class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <i class="pi pi-info-circle mr-1.5" />
              You can skip this and configure booking windows from the Schedule tab on the venue page later.
            </div>
          </div>
        </template>

        <!-- ── Step 5: Review ── -->
        <template v-else-if="currentStep === 5">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Review &amp; create</h2>
            <p class="text-sm text-gray-500 mt-1">Check everything looks right before creating the venue.</p>
          </div>

          <div class="flex flex-col gap-3">
            <div class="p-4 bg-white border border-gray-200 rounded-xl flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">Details</span>
                <button class="text-xs text-[#1E2157] hover:underline" @click="currentStep = 1">Edit</button>
              </div>
              <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <span class="text-gray-500">Name</span><span class="font-medium text-gray-800">{{ form.name }}</span>
                <span class="text-gray-500">Type</span><span class="text-gray-700">{{ form.venue_level === 'AREA' ? 'Sub-venue' : 'Venue' }}</span>
                <span v-if="form.location" class="text-gray-500">Location</span>
                <span v-if="form.location" class="text-gray-700">{{ form.location }}</span>
                <span v-if="form.max_concurrent" class="text-gray-500">Capacity</span>
                <span v-if="form.max_concurrent" class="text-gray-700">{{ form.max_concurrent }}</span>
              </div>
            </div>

            <div class="p-4 bg-white border border-gray-200 rounded-xl flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">Layouts</span>
                <button class="text-xs text-[#1E2157] hover:underline" @click="currentStep = 3">Edit</button>
              </div>
              <div v-if="form.layouts.filter(l => l.name.trim()).length" class="flex flex-wrap gap-2">
                <span v-for="l in form.layouts.filter(l => l.name.trim())" :key="l.name"
                  class="px-2.5 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                  {{ l.name }}
                </span>
              </div>
              <p v-else class="text-sm text-gray-400 italic">None — can be added later</p>
            </div>

            <div class="p-4 bg-white border border-gray-200 rounded-xl flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-gray-800">Booking windows</span>
                <button class="text-xs text-[#1E2157] hover:underline" @click="currentStep = 4">Edit</button>
              </div>
              <div v-if="form.windows.length" class="flex flex-col gap-1">
                <div v-for="(w, i) in form.windows" :key="i" class="text-sm text-gray-700">
                  Window {{ i + 1 }}: {{ w.window_type }} · {{ w.start_time || '?' }}–{{ w.end_time || '?' }}
                  · {{ formatWindowDays(w.days) }}
                </div>
              </div>
              <p v-else class="text-sm text-gray-400 italic">None — can be configured later</p>
            </div>
          </div>
        </template>

      </div>
    </div>

    <!-- Bottom nav -->
    <div class="bg-white border-t border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
      <Button label="Back" severity="secondary" outlined size="small"
        @click="currentStep === 1 ? navigateTo('/bookables') : currentStep--" />
      <span class="text-xs text-gray-400">Step {{ currentStep }} of {{ steps.length }}</span>
      <Button
        :label="currentStep === steps.length ? 'Create venue' : `Next: ${steps[currentStep]?.label ?? ''}`"
        :loading="saving"
        :disabled="currentStep === 1 && !form.name.trim()"
        :style="currentStep === steps.length
          ? 'background:#34B66D; border-color:#34B66D'
          : 'background:#1E2157; border-color:#1E2157'"
        @click="nextStep" />
    </div>

  </div>
  <Toast />
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const route = useRoute()

const currentStep = ref(1)
const saving = ref(false)
const createdId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const categoryInput = ref('')
const selectedCategories = ref<string[]>([])
const allVenues = ref<any[]>([])
const existingSports = ref<string[]>([])

function toggleCategory(sport: string) {
  const idx = selectedCategories.value.indexOf(sport)
  if (idx === -1) selectedCategories.value.push(sport)
  else selectedCategories.value.splice(idx, 1)
}

const steps = [
  { key: 'details',  label: 'Details' },
  { key: 'photos',   label: 'Photos' },
  { key: 'layouts',  label: 'Layouts' },
  { key: 'windows',  label: 'Booking windows' },
  { key: 'review',   label: 'Review' },
]

const venueLevelOptions = [
  { label: 'Venue', value: 'VENUE' },
  { label: 'Sub-venue', value: 'AREA' },
]

const modePriceTypes = [
  { label: 'Included in layout', value: 'INCLUDED' },
  { label: 'Fixed price',        value: 'FIXED' },
  { label: 'Per hour',           value: 'PER_HOUR' },
  { label: 'Per person',         value: 'PER_PERSON' },
  { label: 'Free',               value: 'FREE' },
]

const windowTypes = [
  { label: 'Open',    value: 'OPEN' },
  { label: 'Slotted', value: 'SLOTTED' },
  { label: 'Fixed',   value: 'FIXED' },
]

const weekDays = [
  { label: 'Monday',    short: 'M',  value: 0 },
  { label: 'Tuesday',   short: 'T',  value: 1 },
  { label: 'Wednesday', short: 'W',  value: 2 },
  { label: 'Thursday',  short: 'T',  value: 3 },
  { label: 'Friday',    short: 'F',  value: 4 },
  { label: 'Saturday',  short: 'S',  value: 5 },
  { label: 'Sunday',    short: 'S',  value: 6 },
]

// Time options in 30-min increments
const timeOptions = computed(() => {
  const opts = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const ampm = h < 12 ? 'am' : 'pm'
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      opts.push({ label: `${h12}:${String(m).padStart(2, '0')}${ampm}`, value: val })
    }
  }
  return opts
})

const durationOptions = [
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '1 hour',     value: 60 },
  { label: '1.5 hours',  value: 90 },
  { label: '2 hours',    value: 120 },
  { label: '3 hours',    value: 180 },
  { label: '4 hours',    value: 240 },
]

const form = reactive({
  name: '',
  venue_level: 'VENUE' as 'VENUE' | 'AREA',
  parent_id: null as string | null,
  max_concurrent: 0,
  location: '',
  description: '',
  images: [] as any[],
  layouts: [] as Array<{
    name: string
    modes: Array<{ name: string; description: string; min_players: number | null; max_players: number | null; price: number; price_type: string }>
  }>,
  windows: [] as Array<{
    window_type: string
    days: number[]
    start_time: string
    end_time: string
    slot_duration_mins: number
    capacity: number
  }>,
})

const venueTree = computed(() => {
  const result: any[] = []
  function addNodes(parentId: string | null, depth: number) {
    for (const v of allVenues.value.filter(v => v.parent_id === parentId)) {
      result.push({ ...v, depth, label: v.name })
      addNodes(v.id, depth + 1)
    }
  }
  addNodes(null, 0)
  return result
})

function addCategory() {
  const v = categoryInput.value.trim().replace(/,$/, '')
  if (v && !selectedCategories.value.includes(v)) selectedCategories.value.push(v)
  categoryInput.value = ''
}

function handleFileUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    form.images.push({ url: URL.createObjectURL(file), name: file.name })
  }
}

function addWindow() {
  form.windows.push({
    window_type: 'OPEN',
    days: [0, 1, 2, 3, 4],
    start_time: '09:00',
    end_time: '17:00',
    slot_duration_mins: 60,
    capacity: 1,
  })
}

function toggleDay(win: typeof form.windows[0], day: number) {
  const idx = win.days.indexOf(day)
  idx === -1 ? win.days.push(day) : win.days.splice(idx, 1)
}

function formatWindowDays(days: number[]) {
  const sorted = [...days].sort()
  if (sorted.length === 7) return 'Every day'
  if (sorted.length === 0) return 'No days'
  const names = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  return sorted.map(d => names[d]).join(', ')
}

async function saveVenue(): Promise<boolean> {
  saving.value = true
  try {
    const payload: any = {
      org_id: orgId.value,
      name: form.name.trim(),
      type: 'VENUE',
      status: 'ACTIVE',
      parent_id: form.venue_level === 'AREA' ? (form.parent_id ?? (route.query.parentId as string ?? null)) : null,
      max_concurrent: form.max_concurrent || 1,
      location: form.location || null,
      description: form.description || null,
      sports: selectedCategories.value.length ? selectedCategories.value : null,
    }
    if (createdId.value) {
      const { error } = await db.from('bookables').update(payload).eq('id', createdId.value)
      if (error) throw error
    } else {
      const { data, error } = await db.from('bookables').insert(payload).select().single()
      if (error) throw error
      createdId.value = (data as any).id
    }
    return true
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Save failed', detail: err?.message, life: 4000 })
    return false
  } finally {
    saving.value = false
  }
}

async function saveLayouts() {
  if (!createdId.value || !form.layouts.filter(l => l.name.trim()).length) return
  const validLayouts = form.layouts.filter(l => l.name.trim())
  const { data: insertedLayouts } = await (db.from as any)('bookable_layouts').insert(
    validLayouts.map((l, i) => ({
      bookable_id: createdId.value,
      name: l.name.trim(),
      sort_order: i,
    }))
  ).select()
  if (!insertedLayouts) return
  const modeRows: any[] = []
  insertedLayouts.forEach((row: any, i: number) => {
    const src = validLayouts[i]
    ;(src.modes ?? []).filter((m: any) => m.name?.trim()).forEach((m: any, mi: number) => {
      modeRows.push({
        layout_id: row.id,
        name: m.name.trim(),
        description: m.description?.trim() || null,
        min_players: m.min_players ?? null,
        max_players: m.max_players ?? null,
        price: m.price ?? 0,
        price_type: m.price_type ?? 'INCLUDED',
        sort_order: mi,
      })
    })
  })
  if (modeRows.length) await (db.from as any)('bookable_layout_modes').insert(modeRows)
}

async function saveWindows() {
  if (!createdId.value || !form.windows.length) return
  await (db.from as any)('booking_windows').insert(
    form.windows.map((w, i) => ({
      bookable_id: createdId.value,
      name: `Window ${i + 1}`,
      window_type: w.window_type,
      days_of_week: [...w.days].sort(),
      start_time: w.start_time || '09:00',
      end_time: w.end_time || '17:00',
      slot_duration_mins: w.window_type !== 'FIXED' ? w.slot_duration_mins : null,
      capacity: w.capacity,
      sort_order: i,
    }))
  )
}

async function nextStep() {
  if (currentStep.value === 1) {
    const ok = await saveVenue()
    if (!ok) return
  }
  if (currentStep.value === steps.length) {
    saving.value = true
    try {
      await saveLayouts()
      await saveWindows()
      toast.add({ severity: 'success', summary: 'Venue created!', life: 3000 })
      await navigateTo(createdId.value ? `/bookables/${createdId.value}` : '/bookables')
    } catch (err: any) {
      toast.add({ severity: 'error', summary: 'Error', detail: err?.message, life: 4000 })
    } finally {
      saving.value = false
    }
    return
  }
  currentStep.value++
}

onMounted(async () => {
  const { data } = await db.from('bookables').select('id, name, parent_id, sports')
    .eq('org_id', orgId.value).eq('type', 'VENUE').neq('status', 'DELETED').order('name')
  allVenues.value = data ?? []
  const sportsSet = new Set<string>()
  for (const row of data ?? []) {
    for (const s of row.sports ?? []) sportsSet.add(s)
  }
  existingSports.value = [...sportsSet].sort()
  if (route.query.parentId) {
    form.venue_level = 'AREA'
    form.parent_id = route.query.parentId as string
  }
})
</script>
