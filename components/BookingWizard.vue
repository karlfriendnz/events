<template>
  <Dialog :visible="modelValue" @update:visible="$emit('update:modelValue', $event)"
    :header="editingId ? 'Edit Booking' : 'New Booking'"
    modal :style="{ width: '640px' }" :draggable="false" :closable="true">

    <!-- Step indicator -->
    <div class="flex items-center justify-center gap-1 mb-6">
      <template v-for="(label, i) in stepLabels" :key="i">
        <div class="flex items-center gap-1.5">
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all"
            :class="step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-400'">
            <i v-if="step > i + 1" class="pi pi-check" style="font-size:10px" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="text-xs font-medium hidden sm:block"
            :class="step === i + 1 ? 'text-gray-800' : 'text-gray-400'">{{ label }}</span>
        </div>
        <div v-if="i < stepLabels.length - 1" class="w-6 h-px bg-gray-200 mx-1" />
      </template>
    </div>

    <!-- ───── STEP 1: Date, Time & Layout ───── -->
    <div v-if="step === 1" class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Start <span class="text-red-400">*</span></label>
          <DatePicker v-model="form.start_at" show-time hour-format="12" date-format="d M yy" class="w-full" @update:model-value="onStartChanged" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">End <span class="text-red-400">*</span></label>
          <DatePicker v-model="form.end_at" show-time hour-format="12" date-format="d M yy" class="w-full" :min-date="form.start_at ?? undefined" />
        </div>
      </div>

      <!-- Duration display -->
      <div v-if="durationDisplay" class="flex items-center gap-2 text-sm text-gray-500">
        <i class="pi pi-clock text-gray-400" />
        {{ durationDisplay }}
        <span v-if="conflictWarning" class="ml-auto flex items-center gap-1.5 text-amber-600 font-medium">
          <i class="pi pi-exclamation-triangle" />
          {{ conflictWarning }}
        </span>
        <span v-else-if="form.start_at && form.end_at" class="ml-auto flex items-center gap-1.5 text-green-600">
          <i class="pi pi-check-circle" />
          Available
        </span>
      </div>

      <!-- Layout selection -->
      <div v-if="bookable.layouts?.length" class="flex flex-col gap-2">
        <label class="text-sm font-medium text-gray-700">Layout</label>
        <div class="grid grid-cols-3 gap-2">
          <div v-for="layout in bookable.layouts" :key="layout"
            class="border-2 rounded-xl p-3 cursor-pointer text-center transition-colors"
            :class="form.layout_name === layout
              ? 'border-[#1E2157] bg-[#1E2157]/5'
              : 'border-gray-200 hover:border-gray-300'"
            @click="form.layout_name = layout">
            <i class="pi pi-table block text-lg mb-1"
              :class="form.layout_name === layout ? 'text-[#1E2157]' : 'text-gray-400'" />
            <p class="text-xs font-medium" :class="form.layout_name === layout ? 'text-[#1E2157]' : 'text-gray-700'">{{ layout }}</p>
            <p v-if="getLayoutConfig(layout)" class="text-xs text-gray-400 mt-0.5">
              Cap. {{ getLayoutConfig(layout)?.capacity ?? '—' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Attendee count -->
      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-gray-700">Expected attendees</label>
        <InputNumber v-model="form.attendee_count" :min="1" class="w-36" />
      </div>
    </div>

    <!-- ───── STEP 2: Contact & Confirm ───── -->
    <div v-else-if="step === 2" class="space-y-4">

      <!-- Contact details -->
      <div class="grid grid-cols-2 gap-3">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Contact name</label>
          <InputText v-model="form.contact_name" placeholder="Full name" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Contact email</label>
          <InputText v-model="form.contact_email" type="email" placeholder="email@example.com" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Phone</label>
          <InputText v-model="form.contact_phone" type="tel" placeholder="04xx xxx xxx" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium text-gray-700">Status</label>
          <Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" class="w-full" />
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <label class="text-sm font-medium text-gray-700">Notes</label>
        <Textarea v-model="form.notes" rows="2" auto-resize placeholder="Any special requirements…" class="text-sm" />
      </div>

      <!-- Booking summary -->
      <div class="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-600 space-y-1">
        <p class="font-semibold text-gray-800">{{ bookable.name }}</p>
        <p>{{ formatDT(form.start_at) }} → {{ formatDT(form.end_at) }}<span v-if="form.layout_name"> · {{ form.layout_name }}</span></p>
        <p v-if="durationDisplay" class="text-gray-400">{{ durationDisplay }}</p>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center w-full gap-2">
        <button v-if="editingId" type="button" class="text-sm text-red-400 hover:text-red-600 transition-colors mr-2"
          @click="deleteBooking">Delete booking</button>
        <Button v-if="step > 1" label="Back" severity="secondary" text icon="pi pi-arrow-left" @click="step--" />
        <div class="flex-1" />
        <Button v-if="step < 2" label="Next" icon="pi pi-arrow-right" icon-pos="right"
          :disabled="!canProceed" @click="step++"
          style="background:#1E2157;border-color:#1E2157" />
        <Button v-else :label="editingId ? 'Save changes' : 'Confirm booking'"
          icon="pi pi-check" :loading="saving" @click="confirm"
          style="background:#1E2157;border-color:#1E2157" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  bookable: any
  prefillDate?: Date | null
  prefillEndDate?: Date | null
  editBooking?: any
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  saved: []
}>()

const db = useDb()

const step = ref(1)
const saving = ref(false)
const editingId = computed(() => props.editBooking?.id ?? null)

const stepLabels = ['Date & Layout', 'Contact & Confirm']

// ── Config data ──
const layoutConfigs = ref<any[]>([])
const existingBookings = ref<any[]>([])

// ── Form ──
const form = reactive({
  start_at: null as Date | null,
  end_at: null as Date | null,
  layout_name: null as string | null,
  attendee_count: 1,
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  status: 'CONFIRMED',
  notes: '',
})

const statusOptions = [
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Pending',   value: 'PENDING' },
]

// ── Derived ──
const durationDisplay = computed(() => {
  if (!form.start_at || !form.end_at) return ''
  const mins = (form.end_at.getTime() - form.start_at.getTime()) / 60000
  if (mins <= 0) return 'Invalid range'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
})

const conflictWarning = computed(() => {
  if (!form.start_at || !form.end_at) return ''
  const start = form.start_at.getTime()
  const end   = form.end_at.getTime()
  const conflicts = existingBookings.value.filter(b => {
    if (b.id === editingId.value) return false
    if (b.status === 'CANCELLED') return false
    const bStart = new Date(b.start_at).getTime()
    const bEnd   = new Date(b.end_at).getTime()
    return start < bEnd && end > bStart
  })
  return conflicts.length ? `${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}` : ''
})

const canProceed = computed(() => {
  if (step.value === 1) return !!form.start_at && !!form.end_at && (form.end_at > form.start_at)
  return true
})

// ── Helpers ──
function getLayoutConfig(layoutName: string) {
  return layoutConfigs.value.find(lc => lc.layout_name === layoutName) ?? null
}

function formatDT(d: Date | null) {
  if (!d) return '—'
  return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function onStartChanged(val: Date | null) {
  if (!val || !form.end_at) return
  if (form.end_at <= val) {
    const end = new Date(val)
    end.setHours(end.getHours() + 1)
    form.end_at = end
  }
}

// ── Confirm / Save ──
async function confirm() {
  if (!form.start_at || !form.end_at) return
  saving.value = true
  try {
    const payload: any = {
      bookable_id: props.bookable.id,
      start_at: form.start_at.toISOString(),
      end_at: form.end_at.toISOString(),
      type: 'ONE_OFF',
      status: form.status,
      layout_name: form.layout_name,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      notes: form.notes || null,
    }

    if (editingId.value) {
      const { error } = await db.from('bookings').update(payload).eq('id', editingId.value)
      if (error) throw error
    } else {
      const { error } = await db.from('bookings').insert(payload)
      if (error) throw error
    }

    emit('update:modelValue', false)
    emit('saved')
  } finally {
    saving.value = false
  }
}

async function deleteBooking() {
  if (!editingId.value) return
  if (!confirm('Delete this booking?')) return
  await db.from('bookings').delete().eq('id', editingId.value)
  emit('update:modelValue', false)
  emit('saved')
}

// ── Load config data ──
async function load() {
  const [lcRes, bkRes] = await Promise.all([
    db.from('bookable_layout_configs').select('*').eq('bookable_id', props.bookable.id),
    db.from('bookings').select('id,start_at,end_at,status').eq('bookable_id', props.bookable.id),
  ])
  layoutConfigs.value = lcRes.data ?? []
  existingBookings.value = bkRes.data ?? []
}

// ── Watch for open / edit ──
watch(() => props.modelValue, (open) => {
  if (!open) return
  step.value = 1

  if (props.editBooking) {
    const b = props.editBooking
    form.start_at       = b.start_at ? new Date(b.start_at) : null
    form.end_at         = b.end_at   ? new Date(b.end_at)   : null
    form.layout_name    = b.layout_name ?? null
    form.attendee_count = 1
    form.contact_name   = b.contact_name ?? ''
    form.contact_email  = b.contact_email ?? ''
    form.contact_phone  = b.contact_phone ?? ''
    form.status         = b.status ?? 'CONFIRMED'
    form.notes          = b.notes ?? ''
  } else {
    const start = props.prefillDate ?? new Date()
    if (!props.prefillDate) {
      start.setMinutes(0, 0, 0)
      start.setHours(9)
    }
    const end = props.prefillEndDate ?? new Date(start)
    if (!props.prefillEndDate) end.setHours(end.getHours() + 1)
    form.start_at       = start
    form.end_at         = end
    form.layout_name    = props.bookable.layouts?.[0] ?? null
    form.attendee_count = 1
    form.contact_name   = ''
    form.contact_email  = ''
    form.contact_phone  = ''
    form.status         = 'CONFIRMED'
    form.notes          = ''
  }
})

onMounted(load)
</script>
