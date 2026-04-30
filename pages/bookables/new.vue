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
      <div class="flex items-center min-w-max mx-auto justify-center">
        <template v-for="(step, i) in steps" :key="step.key">
          <button class="flex flex-col items-center gap-1 shrink-0 group"
            :disabled="i + 1 > maxStepReached" @click="goToStep(i + 1)">
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
          </button>
          <div v-if="i < steps.length - 1" class="w-10 md:w-16 h-px mx-1 mb-3 sm:mb-0 transition-colors shrink-0"
            :class="currentStep > i + 1 ? 'bg-[#1E2157]' : 'bg-gray-200'" />
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
            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Name <span class="text-red-400">*</span></label>
              <InputText v-model="form.name" placeholder="e.g. Main Hall, Court 1" class="flex-1" autofocus />
            </div>

            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Parent venue</label>
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

            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Location</label>
              <InputText v-model="form.location" placeholder="Address or description" class="flex-1" />
            </div>

            <div class="flex items-center gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Max capacity</label>
              <InputNumber v-model="form.max_concurrent" :min="1" class="w-28" />
              <span class="text-xs text-gray-400">simultaneous bookings allowed</span>
            </div>

            <div class="flex items-start gap-4">
              <label class="w-40 text-sm font-medium text-gray-700 shrink-0 pt-1">Description</label>
              <Textarea v-model="form.description" rows="2" auto-resize placeholder="Optional"
                class="flex-1 text-sm" />
            </div>
          </div>
        </template>

        <!-- ── Step 2: Activities ── -->
        <template v-if="currentStep === 2">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">What happens here?</h2>
            <p class="text-sm text-gray-500 mt-1">
              Pick the activities people can book at this venue. You need at least one.
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
              class="flex items-center gap-3 px-5 py-3 bg-amber-50/50">
              <i class="pi pi-plus-circle text-amber-500 text-sm" />
              <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                :style="{ background: na.color + '22', color: na.color }">
                <i class="pi pi-bolt text-sm" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">{{ na.name }}</p>
                <p class="text-[11px] text-amber-600">New activity — will be created</p>
              </div>
              <button class="text-gray-400 hover:text-red-500" @click="form.new_activities.splice(i, 1)">
                <i class="pi pi-times text-xs" />
              </button>
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
                @click="addNewActivity" style="background:#1E2157;border-color:#1E2157" />
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
                      ? 'bg-[#1E2157] border-[#1E2157] text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'"
                    @click="toggleDay(i)">
                    {{ d }}
                  </button>
                </div>
              </div>

              <div class="flex items-center gap-4">
                <label class="w-40 text-sm font-medium text-gray-700 shrink-0">Hours</label>
                <Select v-model="form.time_from" :options="timeSlots" option-label="label" option-value="value"
                  placeholder="From" class="w-32" />
                <span class="text-gray-400 text-sm">to</span>
                <Select v-model="form.time_to" :options="timeSlots" option-label="label" option-value="value"
                  placeholder="To" class="w-32" />
              </div>
            </template>
          </div>
        </template>

        <!-- ── Step 4: Discounts ── -->
        <template v-if="currentStep === 4">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Apply any discounts?</h2>
            <p class="text-sm text-gray-500 mt-1">
              Optional. Selected discounts will apply to the activities at this venue.
            </p>
          </div>

          <div v-if="loadingDiscounts" class="bg-white rounded-xl border border-gray-200 p-8 flex justify-center">
            <i class="pi pi-spin pi-spinner text-xl text-gray-400" />
          </div>

          <div v-else-if="!existingDiscounts.length"
            class="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
            <div class="w-12 h-12 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <i class="pi pi-tag text-gray-400" />
            </div>
            <p class="text-sm text-gray-500">No discounts set up yet.</p>
            <p class="text-xs text-gray-400 mt-1">You can add them later under Discounts.</p>
          </div>

          <div v-else class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <label v-for="d in existingDiscounts" :key="d.id"
              class="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50">
              <Checkbox :model-value="form.discount_ids.includes(d.id)" :binary="true"
                @update:model-value="toggleDiscount(d.id)" />
              <div class="w-9 h-9 rounded-lg bg-[#EFF6FF] flex items-center justify-center shrink-0">
                <i class="pi pi-tag text-[#1E2157] text-sm" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">{{ d.name }}</p>
                <p class="text-xs text-gray-400">
                  {{ d.modifier_type === 'PERCENT' ? `${d.modifier_value}% off` : `$${d.modifier_value} off` }}
                </p>
              </div>
            </label>
          </div>
        </template>

        <!-- ── Step 5: Review ── -->
        <template v-if="currentStep === 5">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">Ready to create?</h2>
            <p class="text-sm text-gray-500 mt-1">Review the details below — you can change everything later.</p>
          </div>

          <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            <div class="px-5 py-4">
              <p class="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Venue</p>
              <p class="text-sm font-semibold text-gray-800">{{ form.name }}</p>
              <p v-if="parentName" class="text-xs text-gray-500">Sub-venue of {{ parentName }}</p>
              <p v-if="form.location" class="text-xs text-gray-500">{{ form.location }}</p>
              <p class="text-xs text-gray-500">Max capacity: {{ form.max_concurrent }}</p>
            </div>

            <div class="px-5 py-4">
              <p class="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-2">
                Activities ({{ form.activity_ids.length + form.new_activities.length }})
              </p>
              <div class="flex flex-wrap gap-1.5">
                <span v-for="aid in form.activity_ids" :key="aid"
                  class="text-xs px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1E2157] font-medium">
                  {{ existingActivities.find(a => a.id === aid)?.name }}
                </span>
                <span v-for="(na, i) in form.new_activities" :key="i"
                  class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                  + {{ na.name }}
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

            <div class="px-5 py-4">
              <p class="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">
                Discounts ({{ form.discount_ids.length }})
              </p>
              <p v-if="!form.discount_ids.length" class="text-sm text-gray-500">None</p>
              <div v-else class="flex flex-wrap gap-1.5">
                <span v-for="did in form.discount_ids" :key="did"
                  class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                  {{ existingDiscounts.find(d => d.id === did)?.name }}
                </span>
              </div>
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
        style="background:#1E2157;border-color:#1E2157" />
      <Button v-else label="Create Venue" icon="pi pi-check" icon-pos="right" size="small"
        :loading="creating" @click="submit" style="background:#1E2157;border-color:#1E2157" />
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

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
  { key: 'discounts',    label: 'Discounts' },
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
  activity_ids: [] as string[],
  new_activities: [] as { name: string; color: string }[],
  availability_mode: 'ALWAYS' as 'ALWAYS' | 'SCHEDULED',
  days: [0, 1, 2, 3, 4, 5, 6],
  time_from: '09:00',
  time_to: '21:00',
  discount_ids: [] as string[],
})

// Existing data
const allBookables = ref<any[]>([])
const existingActivities = ref<any[]>([])
const existingDiscounts = ref<any[]>([])
const loadingActivities = ref(false)
const loadingDiscounts = ref(false)

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
  form.new_activities.push({ name, color: newActivityColor.value })
  newActivityName.value = ''
  newActivityColor.value = COLORS[(form.new_activities.length) % COLORS.length]
}

function toggleActivity(id: string) {
  const i = form.activity_ids.indexOf(id)
  if (i >= 0) form.activity_ids.splice(i, 1)
  else form.activity_ids.push(id)
}

function toggleDiscount(id: string) {
  const i = form.discount_ids.indexOf(id)
  if (i >= 0) form.discount_ids.splice(i, 1)
  else form.discount_ids.push(id)
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
  if (currentStep.value === 2) return form.activity_ids.length + form.new_activities.length > 0
  if (currentStep.value === 3) {
    if (form.availability_mode === 'ALWAYS') return true
    return form.days.length > 0 && !!form.time_from && !!form.time_to && form.time_from < form.time_to
  }
  return true
})

const stepError = computed(() => {
  if (currentStep.value === 1 && !form.name.trim()) return 'Name is required'
  if (currentStep.value === 2 && form.activity_ids.length + form.new_activities.length === 0)
    return 'Pick at least one activity'
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

async function loadActivitiesAndDiscounts() {
  if (!orgId.value) return
  loadingActivities.value = true
  loadingDiscounts.value = true
  const [{ data: a }, { data: d }] = await Promise.all([
    (db.from as any)('activities').select('id, name, description, color, icon').eq('org_id', orgId.value).eq('status', 'ACTIVE').order('name'),
    (db.from as any)('booking_discounts').select('id, name, modifier_type, modifier_value').eq('org_id', orgId.value).eq('is_active', true).order('name'),
  ])
  existingActivities.value = a ?? []
  existingDiscounts.value = d ?? []
  loadingActivities.value = false
  loadingDiscounts.value = false
}

watch(orgId, () => {
  loadParents()
  loadActivitiesAndDiscounts()
}, { immediate: true })

async function submit() {
  if (!orgId.value) {
    toast.add({ severity: 'error', summary: 'Not ready', detail: 'Org not loaded', life: 3000 })
    return
  }
  creating.value = true
  try {
    // 1. Create the bookable
    const { data: venue, error: venueErr } = await (db.from as any)('bookables').insert({
      org_id: orgId.value,
      name: form.name.trim(),
      type: 'VENUE',
      status: 'ACTIVE',
      parent_id: form.parent_id || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      max_concurrent: form.max_concurrent || 1,
    }).select('id').single()

    if (venueErr || !venue?.id) throw venueErr ?? new Error('Could not create venue')

    // 2. Create new activities
    let createdActivityIds: string[] = []
    if (form.new_activities.length) {
      const { data: created } = await (db.from as any)('activities').insert(
        form.new_activities.map(na => ({
          org_id: orgId.value,
          name: na.name,
          color: na.color,
          status: 'ACTIVE',
        })),
      ).select('id')
      createdActivityIds = (created ?? []).map((r: any) => r.id)
    }

    const allActivityIds = [...form.activity_ids, ...createdActivityIds]

    // 3. Link activities to the venue
    if (allActivityIds.length) {
      await (db.from as any)('activity_bookables').insert(
        allActivityIds.map(activity_id => ({ activity_id, bookable_id: venue.id })),
      )
    }

    // 4. Availability rule (only if scheduled)
    if (form.availability_mode === 'SCHEDULED') {
      await (db.from as any)('availability_rules').insert({
        bookable_id: venue.id,
        name: 'Open hours',
        rule_type: 'OPEN',
        days_of_week: form.days,
        time_slots: [{ from: form.time_from, to: form.time_to }],
        is_active: true,
      })
    }

    // 5. Apply discounts to selected activities
    if (form.discount_ids.length && allActivityIds.length) {
      const rows: any[] = []
      for (const did of form.discount_ids) {
        for (const aid of allActivityIds) {
          rows.push({ discount_id: did, activity_id: aid })
        }
      }
      await (db.from as any)('booking_discount_activities').upsert(rows, { onConflict: 'discount_id,activity_id' })
    }

    toast.add({ severity: 'success', summary: 'Venue created', life: 2500 })
    await navigateTo(`/bookables/${venue.id}`)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not create venue', detail: e?.message ?? 'Unknown error', life: 4000 })
  } finally {
    creating.value = false
  }
}
</script>
