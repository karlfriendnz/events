<template>
  <div class="flex flex-col h-[calc(100vh-3.5rem-4rem)] md:h-[calc(100vh-3.5rem)]">

    <!-- Top bar -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
      <button class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        @click="navigateTo('/bookables')">
        <i class="pi pi-times text-xs" />
        <span class="hidden sm:inline">Cancel</span>
      </button>
      <span class="text-sm font-semibold text-gray-800">Create Venue</span>
      <NuxtLink to="/bookables/new-v2" class="text-xs text-gray-400 hover:text-gray-700">
        Try v2 →
      </NuxtLink>
    </div>

    <!-- Step indicators -->
    <div class="bg-white border-b border-gray-200 px-4 md:px-6 py-3 shrink-0 overflow-x-auto">
      <div class="flex items-center min-w-max mx-auto justify-center">
        <template v-for="(step, i) in steps" :key="step.key">
          <button class="flex flex-col items-center gap-1 shrink-0 group"
            :disabled="i + 1 > maxStepReached" @click="goToStep(i + 1)">
            <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs border-2 transition-all"
              :class="currentStep > i + 1
                ? 'bg-primary border-primary text-white'
                : currentStep === i + 1
                ? 'bg-white border-primary text-primary font-semibold'
                : 'bg-white border-gray-200 text-gray-400'">
              <i v-if="currentStep > i + 1" class="pi pi-check text-[10px]" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="hidden sm:inline text-[10px] whitespace-nowrap font-medium"
              :class="currentStep === i + 1 ? 'text-primary' : currentStep > i + 1 ? 'text-gray-500' : 'text-gray-300'">
              {{ step.label }}
            </span>
          </button>
          <div v-if="i < steps.length - 1" class="w-10 md:w-16 h-px mx-1 mb-3 sm:mb-0 transition-colors shrink-0"
            :class="currentStep > i + 1 ? 'bg-primary' : 'bg-gray-200'" />
        </template>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
      <div class="max-w-2xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">

        <!-- ── Step 1: Venue details ── -->
        <template v-if="currentStep === 1">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Venue details</h2>
            <p class="text-sm text-gray-500 mt-1">Basic information about the space people will book.</p>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0">Name <span class="text-red-400">*</span></label>
              <InputText v-model="form.name" placeholder="e.g. Main Hall, Court 1" class="flex-1" autofocus />
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0">Parent venue</label>
              <Select v-model="form.parent_id" :options="parentOptions" option-label="name" option-value="id"
                placeholder="None — top-level venue" class="flex-1" show-clear>
                <template #option="{ option }">
                  <div class="flex items-center gap-1">
                    <span v-for="n in option.depth" :key="n" class="text-gray-300 mr-0.5">›</span>
                    {{ option.name }}
                  </div>
                </template>
              </Select>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0">Location</label>
              <InputText v-model="form.location" placeholder="Address or description" class="flex-1" />
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0">Number of venues</label>
              <InputNumber v-model="form.count" :min="1" :max="200" input-class="w-16" class="shrink-0" />
              <span class="text-xs text-gray-400 min-w-0">
                {{ form.count > 1
                  ? `Creates ${form.count} auto-numbered: "${form.name || 'Venue'} 1" … "${form.name || 'Venue'} ${form.count}"`
                  : 'Set higher than 1 to create several at once (e.g. 10 lockers, 4 courts)' }}
              </span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0">Max capacity</label>
              <InputNumber v-model="form.max_concurrent" :min="1" input-class="w-16" class="shrink-0" />
              <span class="text-xs text-gray-400 min-w-0">simultaneous bookings per venue</span>
            </div>

            <div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
              <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0 pt-1">Description</label>
              <Textarea v-model="form.description" rows="2" auto-resize placeholder="Optional"
                class="flex-1 text-sm" />
            </div>

            <div class="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
              <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0 pt-1">Image</label>
              <div class="flex-1">
                <div v-if="!form.main_image"
                  class="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary transition-colors cursor-pointer"
                  @click="imageInput?.click()">
                  <i class="pi pi-image text-2xl text-gray-300" />
                  <Button label="Upload image" severity="secondary" outlined size="small" icon="pi pi-upload" />
                </div>
                <div v-else class="relative rounded-xl overflow-hidden w-48">
                  <img :src="form.main_image" class="w-full h-32 object-cover" />
                  <div v-if="uploadingImage" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <i class="pi pi-spin pi-spinner text-white text-xl" />
                  </div>
                  <Button v-else icon="pi pi-times" severity="danger" rounded size="small"
                    class="absolute top-2 right-2" @click="form.main_image = ''" />
                </div>
                <input ref="imageInput" type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
              </div>
            </div>
          </div>
        </template>

        <!-- ── Step 2: Activities ── -->
        <template v-if="currentStep === 2">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">What happens here?</h2>
            <p class="text-sm text-gray-500 mt-1">
              Pick the activities people can book at this venue, or skip to add later.
            </p>
          </div>

          <div v-if="loadingActivities" class="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
            <i class="pi pi-spin pi-spinner text-xl text-gray-400" />
          </div>

          <div v-else class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div v-if="!existingActivities.length && !form.new_activities.length"
              class="px-5 py-8 text-center text-sm text-gray-400">
              No activities yet — add one below to start.
            </div>
            <label v-for="a in existingActivities" :key="a.id"
              class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50">
              <Checkbox :model-value="form.activity_ids.includes(a.id)" :binary="true"
                @update:model-value="toggleActivity(a.id)" />
              <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                :style="{ background: (a.color || '#6366F1') + '22', color: a.color || '#6366F1' }">
                <i :class="`pi ${a.icon || 'pi-bolt'} text-sm`" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">{{ a.name }}</p>
                <p v-if="a.description" class="text-xs text-gray-400 truncate">{{ a.description }}</p>
              </div>
            </label>

            <div v-for="(na, i) in form.new_activities" :key="i"
              class="px-5 py-3 bg-amber-50/50">
              <div class="flex items-center gap-3">
                <i class="pi pi-plus-circle text-amber-500 text-sm" />
                <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  :style="{ background: na.color + '22', color: na.color }">
                  <i class="pi pi-bolt text-sm" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-800">{{ na.name }}</p>
                  <p class="text-[11px] text-amber-600">
                    New activity — will be created
                    <span v-if="na.modes.length"> with {{ na.modes.length }} mode{{ na.modes.length === 1 ? '' : 's' }}</span>
                  </p>
                </div>
                <button type="button" class="text-xs font-medium text-primary hover:underline"
                  @click="openModeWizard(i)">
                  <i class="pi pi-plus text-[10px] mr-0.5" /> Add mode
                </button>
                <button type="button" class="text-gray-400 hover:text-red-500"
                  @click="form.new_activities.splice(i, 1)">
                  <i class="pi pi-times text-xs" />
                </button>
              </div>
              <!-- Mode chips for this new activity -->
              <div v-if="na.modes.length" class="flex flex-wrap gap-1.5 mt-2 pl-12">
                <span v-for="(m, mi) in na.modes" :key="mi"
                  class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white border border-amber-200 text-amber-800">
                  <span class="w-2 h-2 rounded-full" :style="{ background: m.color }" />
                  {{ m.name }}
                  <button type="button" class="text-amber-400 hover:text-red-500 ml-0.5"
                    @click="na.modes.splice(mi, 1)">
                    <i class="pi pi-times text-[9px]" />
                  </button>
                </span>
              </div>
            </div>
          </div>

          <!-- Add new activity inline -->
          <div class="bg-white rounded-xl border border-gray-200 p-5">
            <p class="text-sm font-medium text-gray-700 mb-3">Add a new activity</p>
            <div class="flex items-center gap-3">
              <InputText v-model="newActivityName" placeholder="e.g. Tennis, Yoga"
                class="flex-1" @keyup.enter="addNewActivity" />
              <div class="flex gap-1">
                <button v-for="c in COLORS" :key="c" type="button"
                  class="w-5 h-5 rounded-full ring-offset-1 transition-all"
                  :style="{ background: c }"
                  :class="newActivityColor === c ? 'ring-2 ring-gray-700' : 'hover:ring-2 hover:ring-gray-300'"
                  @click="newActivityColor = c" />
              </div>
              <Button label="Add" icon="pi pi-plus" size="small" :disabled="!newActivityName.trim()"
                @click="addNewActivity" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </template>

        <!-- ── Step 3: Availability ── -->
        <template v-if="currentStep === 3">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">When is it open?</h2>
            <p class="text-sm text-gray-500 mt-1">
              You can fine-tune rules later from the venue's Availability tab.
            </p>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
            <div class="flex items-start gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0 pt-1.5">Mode</label>
              <div class="flex flex-col gap-2 flex-1">
                <label class="flex items-center gap-2 cursor-pointer">
                  <RadioButton v-model="form.availability_mode" value="ALWAYS" />
                  <span class="text-sm">Always open (24/7)</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <RadioButton v-model="form.availability_mode" value="SCHEDULED" />
                  <span class="text-sm">Open on certain days and hours</span>
                </label>
              </div>
            </div>

            <template v-if="form.availability_mode === 'SCHEDULED'">
              <div class="flex items-center gap-4">
                <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Days</label>
                <div class="flex gap-1.5 flex-wrap">
                  <button v-for="(d, i) in dayLabels" :key="i" type="button"
                    class="px-3 py-1.5 text-xs rounded-full border transition-colors"
                    :class="form.days.includes(i)
                      ? 'bg-primary border-primary text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'"
                    @click="toggleDay(i)">
                    {{ d }}
                  </button>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                <label class="w-full sm:w-40 text-sm font-medium text-gray-700 shrink-0">Hours</label>
                <div class="flex items-center gap-2 flex-wrap">
                  <Select v-model="form.time_from" :options="timeSlots" option-label="label" option-value="value"
                    placeholder="From" class="w-32" />
                  <span class="text-gray-400 text-sm">to</span>
                  <Select v-model="form.time_to" :options="timeSlots" option-label="label" option-value="value"
                    placeholder="To" class="w-32" />
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- ── Step 4: Review ── -->
        <template v-if="currentStep === 4">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Ready to create?</h2>
            <p class="text-sm text-gray-500 mt-1">Review the details below — you can change everything later.</p>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div class="px-5 py-4">
              <p class="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                {{ form.count > 1 ? `Venues (${form.count})` : 'Venue' }}
              </p>
              <p class="text-sm font-semibold text-gray-800">
                {{ form.count > 1 ? `${form.name} 1 … ${form.count}` : form.name }}
              </p>
              <p v-if="parentName" class="text-xs text-gray-500">Sub-venue of {{ parentName }}</p>
              <p v-if="form.location" class="text-xs text-gray-500">{{ form.location }}</p>
              <p class="text-xs text-gray-500">Max capacity: {{ form.max_concurrent }} per venue</p>
            </div>

            <div class="px-5 py-4">
              <p class="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
                Activities ({{ form.activity_ids.length + form.new_activities.length }})
              </p>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="aid in form.activity_ids" :key="aid"
                  class="text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-primary font-medium">
                  {{ existingActivities.find(a => a.id === aid)?.name }}
                </span>
                <span v-for="(na, i) in form.new_activities" :key="i"
                  class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                  + {{ na.name }}<span v-if="na.modes.length"> · {{ na.modes.length }} mode{{ na.modes.length === 1 ? '' : 's' }}</span>
                </span>
              </div>
            </div>

            <div class="px-5 py-4">
              <p class="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Availability</p>
              <p v-if="form.availability_mode === 'ALWAYS'" class="text-sm text-gray-700">Always open</p>
              <p v-else class="text-sm text-gray-700">
                {{ form.days.map(d => dayLabels[d]).join(', ') }}
                — {{ formatTime(form.time_from) }} to {{ formatTime(form.time_to) }}
              </p>
            </div>

          </div>
        </template>

      </div>
    </div>

    <!-- Bottom nav -->
    <div class="bg-white border-t border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
      <Button label="Back" icon="pi pi-arrow-left" severity="secondary" outlined size="small"
        :disabled="currentStep === 1" @click="back" />
      <p v-if="stepError" class="text-xs text-red-500">{{ stepError }}</p>
      <Button v-if="currentStep < steps.length" label="Continue" icon="pi pi-arrow-right" icon-pos="right"
        size="small" :disabled="!canContinue" @click="next"
        style="background:var(--brand-primary);border-color:var(--brand-primary)" />
      <Button v-else :label="form.count > 1 ? `Create ${form.count} Venues` : 'Create Venue'"
        icon="pi pi-check" icon-pos="right" size="small"
        :loading="creating" @click="submit" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
    </div>

    <Toast />

    <ModeWizard
      v-model:visible="modeWizardOpen"
      :activity-name="modeWizardActivityName"
      @done="onModeCaptured" />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { ModePayload } from '~/components/ModeWizard.vue'

definePageMeta({ layout: 'default' })

const db = useDb()
const { orgId } = useOrg()
const route = useRoute()
const toast = useToast()

const COLORS = ['#6366F1','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#84CC16']
const dayLabels = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

const timeSlots = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2)
  const m = (i % 2) * 30
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
  return { value, label }
})

function formatTime(v: string) {
  return timeSlots.find(s => s.value === v)?.label ?? v
}

const steps = [
  { key: 'details',      label: 'Details' },
  { key: 'activities',   label: 'Activities' },
  { key: 'availability', label: 'Availability' },
  { key: 'review',       label: 'Review' },
]

const currentStep = ref(1)
const maxStepReached = ref(1)
const creating = ref(false)

const form = reactive({
  name: '',
  parent_id: (route.query.parent as string) || null,
  location: '',
  max_concurrent: 1,
  description: '',
  main_image: '',
  count: 1,
  activity_ids: [] as string[],
  new_activities: [] as { name: string; color: string; modes: ModePayload[] }[],
  availability_mode: 'ALWAYS' as 'ALWAYS' | 'SCHEDULED',
  days: [0, 1, 2, 3, 4, 5, 6],
  time_from: '09:00',
  time_to: '21:00',
})

const imageInput = ref<HTMLInputElement | null>(null)
const uploadingImage = ref(false)
const { uploadFile } = useUpload()

async function handleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  form.main_image = URL.createObjectURL(file)
  uploadingImage.value = true
  try { form.main_image = await uploadFile(file) } finally { uploadingImage.value = false }
}

// Existing data
const allBookables = ref<any[]>([])
const existingActivities = ref<any[]>([])
const loadingActivities = ref(false)

const parentOptions = computed(() => {
  const venues = allBookables.value.filter(b => b.type === 'VENUE' && b.status !== 'ARCHIVED' && b.status !== 'DELETED')
  const result: any[] = []
  function walk(parentId: string | null, depth: number) {
    for (const v of venues.filter(b => b.parent_id === parentId)) {
      result.push({ id: v.id, name: v.name, depth })
      walk(v.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
})

const parentName = computed(() =>
  form.parent_id ? allBookables.value.find(b => b.id === form.parent_id)?.name ?? '' : '',
)

// Inline new-activity composer
const newActivityName = ref('')
const newActivityColor = ref(COLORS[0])
function addNewActivity() {
  const name = newActivityName.value.trim()
  if (!name) return
  const newIndex = form.new_activities.length
  form.new_activities.push({ name, color: newActivityColor.value, modes: [] })
  newActivityName.value = ''
  newActivityColor.value = COLORS[(form.new_activities.length) % COLORS.length]
  // Prompt for mode capture immediately. The wizard's "Save & add
  // another" lets users chain modes for the activity, and Cancel still
  // leaves the activity in place with no modes (a default "Default"
  // mode is seeded at submit time so it's still bookable).
  openModeWizard(newIndex)
}

// ── Per-activity mode wizard. We track which queued new-activity row it
//    targets via index, then push the captured ModePayload onto that
//    activity's modes[] when the wizard emits `done`.
const modeWizardOpen = ref(false)
const modeWizardActivityIndex = ref<number | null>(null)
const modeWizardActivityName = computed(() => {
  const i = modeWizardActivityIndex.value
  return i !== null ? form.new_activities[i]?.name ?? '' : ''
})
function openModeWizard(activityIndex: number) {
  modeWizardActivityIndex.value = activityIndex
  modeWizardOpen.value = true
}
function onModeCaptured(mode: ModePayload) {
  const i = modeWizardActivityIndex.value
  if (i === null) return
  form.new_activities[i]?.modes.push(mode)
}

function toggleActivity(id: string) {
  const i = form.activity_ids.indexOf(id)
  if (i >= 0) form.activity_ids.splice(i, 1)
  else form.activity_ids.push(id)
}

function toggleDay(i: number) {
  const idx = form.days.indexOf(i)
  if (idx >= 0) form.days.splice(idx, 1)
  else form.days.push(i)
  form.days.sort((a, b) => a - b)
}

// Step gating
const canContinue = computed(() => {
  if (currentStep.value === 1) return form.name.trim().length > 0
  if (currentStep.value === 3) {
    if (form.availability_mode === 'ALWAYS') return true
    return form.days.length > 0 && !!form.time_from && !!form.time_to && form.time_from < form.time_to
  }
  return true
})

const stepError = computed(() => {
  if (currentStep.value === 1 && !form.name.trim()) return 'Name is required'
  if (currentStep.value === 3 && form.availability_mode === 'SCHEDULED') {
    if (!form.days.length) return 'Pick at least one day'
    if (form.time_from >= form.time_to) return 'End time must be after start time'
  }
  return ''
})

function next() {
  if (!canContinue.value) return
  currentStep.value = Math.min(steps.length, currentStep.value + 1)
  maxStepReached.value = Math.max(maxStepReached.value, currentStep.value)
}
function back() {
  currentStep.value = Math.max(1, currentStep.value - 1)
}
function goToStep(n: number) {
  if (n <= maxStepReached.value) currentStep.value = n
}

async function loadParents() {
  if (!orgId.value) return
  const { data } = await (db.from as any)('bookables').select('id, name, type, parent_id, status').eq('org_id', orgId.value)
  allBookables.value = data ?? []
}

async function loadActivities() {
  if (!orgId.value) return
  loadingActivities.value = true
  const { data } = await (db.from as any)('activities')
    .select('id, name, description, color, icon')
    .eq('org_id', orgId.value).eq('status', 'ACTIVE').order('name')
  existingActivities.value = data ?? []
  loadingActivities.value = false
}

watch(orgId, () => {
  loadParents()
  loadActivities()
}, { immediate: true })

async function submit() {
  if (!orgId.value) {
    toast.add({ severity: 'error', summary: 'Not ready', detail: 'Org not loaded', life: 3000 })
    return
  }
  creating.value = true
  try {
    // 1. Create the bookable(s). When count > 1, the first row is the
    //    master and the rest link via master_id (mirrors <SetupWizard>'s
    //    pattern), so edits to the master propagate to siblings.
    const baseName = form.name.trim()
    const count = Math.max(1, form.count || 1)
    const venueIds: string[] = []
    for (let i = 0; i < count; i++) {
      const isMaster = i === 0
      const name = count === 1 ? baseName : `${baseName} ${i + 1}`
      const { data, error } = await (db.from as any)('bookables').insert({
        org_id: orgId.value,
        name,
        type: 'VENUE',
        status: 'ACTIVE',
        parent_id: form.parent_id || null,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        max_concurrent: form.max_concurrent || 1,
        main_image: form.main_image || null,
        is_public: true,
        is_master: isMaster,
        master_id: isMaster ? null : venueIds[0],
      }).select('id').single()
      if (error || !data?.id) throw error ?? new Error('Could not create venue')
      venueIds.push(data.id)
    }
    const venue = { id: venueIds[0] }

    // 2. Create new activities. For each, persist the modes the user
    //    captured via <ModeWizard>; if none were captured, seed a single
    //    "Default" mode so the activity is bookable end-to-end without a
    //    follow-up trip to the activity editor.
    let createdActivityIds: string[] = []
    if (form.new_activities.length) {
      const { data: created } = await (db.from as any)('activities').insert(
        form.new_activities.map(na => ({
          org_id: orgId.value,
          name: na.name,
          color: na.color,
          status: 'ACTIVE',
        })),
      ).select('id, name')
      createdActivityIds = (created ?? []).map((r: any) => r.id)
      if (created?.length) {
        const modeRows: any[] = []
        created.forEach((row: any, idx: number) => {
          const captured = form.new_activities[idx]?.modes ?? []
          if (captured.length) {
            captured.forEach((m, sort_order) => {
              const pricing = m.default_price != null ? { default: m.default_price } : {}
              modeRows.push({
                activity_id: row.id,
                name: m.name,
                description: m.description || null,
                color: m.color,
                min_people: m.min_people,
                max_people: m.max_people,
                allow_visitors: m.allow_visitors,
                pricing,
                sort_order,
              })
            })
          } else {
            modeRows.push({ activity_id: row.id, name: 'Default' })
          }
        })
        await (db.from as any)('activity_modes').insert(modeRows)
      }
    }

    const allActivityIds = [...form.activity_ids, ...createdActivityIds]

    // 3. Link activities to every sibling so the booker sees them all.
    if (allActivityIds.length) {
      const rows: any[] = []
      for (const vid of venueIds) {
        for (const activity_id of allActivityIds) rows.push({ activity_id, bookable_id: vid })
      }
      await (db.from as any)('activity_bookables').insert(rows)
    }

    // 4. Availability rule per sibling. Always write one — without any
    //    rule the scheduler/calendar treats the venue as having no
    //    bookable slots. ALWAYS = 24/7 across every day; SCHEDULED uses
    //    the picked window. time_from/time_to mirror the first slot for
    //    legacy fallbacks that read those fields directly.
    {
      const isAlways = form.availability_mode === 'ALWAYS'
      const days = isAlways ? [0, 1, 2, 3, 4, 5, 6] : form.days
      const fromTime = isAlways ? '00:00' : form.time_from
      const toTime = isAlways ? '23:59' : form.time_to
      await (db.from as any)('availability_rules').insert(
        venueIds.map(vid => ({
          bookable_id: vid,
          name: isAlways ? 'Always open' : 'Open hours',
          rule_type: 'OPEN',
          days_of_week: days,
          time_slots: [{ from: fromTime, to: toTime }],
          time_from: fromTime,
          time_to: toTime,
          is_active: true,
        })),
      )
    }

    toast.add({
      severity: 'success',
      summary: count === 1 ? 'Venue created' : `${count} venues created`,
      life: 2500,
    })
    await navigateTo(`/bookables/${venue.id}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not create venue', detail: e?.message ?? 'Unknown error', life: 4000 })
  } finally {
    creating.value = false
  }
}
</script>
