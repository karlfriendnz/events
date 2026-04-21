<template>
  <div class="p-6 space-y-4">

    <!-- Windows list -->
    <div v-if="loading" class="flex justify-center py-12">
      <i class="pi pi-spin pi-spinner text-2xl text-gray-300" />
    </div>

    <div v-else-if="!windows.length" class="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-400">
      <i class="pi pi-clock text-3xl block mb-3 text-gray-300" />
      <p class="text-sm font-medium">No booking windows yet</p>
      <p class="text-xs mt-1">Add windows to define when and how this bookable can be booked.</p>
      <Button v-if="!props.readonly" label="Add first window" icon="pi pi-plus" size="small" class="mt-4"
        style="background:#1E2157;border-color:#1E2157" @click="openAdd" />
    </div>

    <div v-else class="space-y-3">
      <div v-for="win in windows" :key="win.id"
        class="bg-white rounded-xl border border-gray-200 overflow-hidden">

        <!-- Window header -->
        <div class="flex items-center gap-4 px-5 py-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <p class="text-sm font-semibold text-gray-900">{{ win.name }}</p>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="windowTypeBadge(win.window_type)">
                {{ win.window_type }}
              </span>
              <span v-if="!win.is_active" class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Inactive</span>
            </div>
            <p class="text-xs text-gray-400">
              {{ formatDays(win.days_of_week) }} · {{ formatTime(win.start_time) }} – {{ formatTime(win.end_time) }}
              <span v-if="win.slot_duration_mins"> · {{ win.slot_duration_mins }}min slots</span>
              <span v-if="win.buffer_mins"> · {{ win.buffer_mins }}min buffer</span>
              <span> · capacity {{ win.capacity }}</span>
            </p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <ToggleSwitch v-if="!props.readonly" :modelValue="win.is_active" @update:modelValue="toggleWindow(win)" />
            <Button v-if="!props.readonly" icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openEdit(win)" />
            <Button v-if="!props.readonly" icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteWindow(win)" />
            <span v-if="props.readonly" class="text-xs text-violet-500 italic">inherited</span>
          </div>
        </div>

        <!-- Fixed slots -->
        <div v-if="win.window_type === 'FIXED'" class="border-t border-gray-100 px-5 py-3">
          <div class="flex items-center justify-between mb-2">
            <p class="text-xs font-medium text-gray-500">Fixed slots</p>
            <button class="text-xs text-[#1E2157] hover:underline" @click="openSlots(win)">Manage slots</button>
          </div>
          <div v-if="win.slots?.length" class="flex flex-wrap gap-2">
            <span v-for="s in win.slots" :key="s.id"
              class="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
              {{ formatTime(s.slot_start) }}–{{ formatTime(s.slot_end) }}
              <span v-if="s.label"> · {{ s.label }}</span>
              <span v-if="s.capacity > 1" class="text-gray-400"> ×{{ s.capacity }}</span>
            </span>
          </div>
          <p v-else class="text-xs text-gray-400">No slots yet — click "Manage slots"</p>
        </div>

      </div>

      <Button v-if="!props.readonly" label="Add window" icon="pi pi-plus" size="small" severity="secondary" outlined @click="openAdd" />
    </div>

    <!-- Window add/edit dialog -->
    <Dialog v-model:visible="showWindowDialog" :header="editTarget?.id ? 'Edit window' : 'Add booking window'" modal style="width:520px">
      <div class="space-y-4 pt-1">
        <div>
          <label class="text-xs font-medium text-gray-600 block mb-1">Name</label>
          <InputText v-model="winForm.name" class="w-full" placeholder="e.g. Morning open booking" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 block mb-1">Type</label>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="t in windowTypes" :key="t.value"
              class="flex flex-col items-start p-3 rounded-xl border text-left transition-colors"
              :class="winForm.window_type === t.value ? 'border-[#1E2157] bg-[#EFF6FF]' : 'border-gray-200 hover:border-gray-300'"
              @click="winForm.window_type = t.value">
              <span class="text-sm font-semibold" :class="winForm.window_type === t.value ? 'text-[#1E2157]' : 'text-gray-700'">{{ t.label }}</span>
              <span class="text-xs text-gray-400 mt-0.5">{{ t.desc }}</span>
            </button>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 block mb-2">Days of week</label>
          <div class="flex gap-1.5">
            <button v-for="(day, i) in dayLabels" :key="i"
              class="w-9 h-9 rounded-lg text-xs font-medium transition-colors"
              :class="winForm.days_of_week.includes(i) ? 'bg-[#1E2157] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
              @click="toggleDay(i)">
              {{ day }}
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Start time</label>
            <Select v-model="winForm.start_time" :options="timeOptions" option-label="label" option-value="value" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">End time</label>
            <Select v-model="winForm.end_time" :options="timeOptions" option-label="label" option-value="value" class="w-full" />
          </div>
        </div>
        <div v-if="winForm.window_type !== 'FIXED'" class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Slot duration (mins)</label>
            <Select v-model="winForm.slot_duration_mins" :options="durationOptions" option-label="label" option-value="value" class="w-full" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">Buffer between slots (mins)</label>
            <InputNumber v-model="winForm.buffer_mins" :min="0" :step="5" class="w-full" />
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 block mb-1">Capacity (simultaneous bookings)</label>
          <InputNumber v-model="winForm.capacity" :min="1" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showWindowDialog = false" />
        <Button :label="editTarget?.id ? 'Save' : 'Add window'" icon="pi pi-check" :loading="saving"
          @click="saveWindow" style="background:#1E2157;border-color:#1E2157" />
      </template>
    </Dialog>

    <!-- Fixed slots dialog -->
    <Dialog v-model:visible="showSlotsDialog" :header="`Slots — ${slotWindow?.name}`" modal style="width:480px">
      <div class="space-y-3 pt-1">
        <div v-if="slotForms.length" class="space-y-2">
          <div v-for="(s, i) in slotForms" :key="i" class="flex items-center gap-2">
            <Select v-model="s.slot_start" :options="timeOptions" option-label="label" option-value="value" size="small" class="w-32" />
            <span class="text-gray-400 text-sm">–</span>
            <Select v-model="s.slot_end" :options="timeOptions" option-label="label" option-value="value" size="small" class="w-32" />
            <InputText v-model="s.label" placeholder="Label (optional)" size="small" class="flex-1" />
            <InputNumber v-model="s.capacity" :min="1" size="small" class="w-16" placeholder="Cap" />
            <button class="text-gray-300 hover:text-red-500" @click="slotForms.splice(i, 1)">
              <i class="pi pi-trash text-sm" />
            </button>
          </div>
        </div>
        <button class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1E2157]"
          @click="slotForms.push({ slot_start: '09:00', slot_end: '10:00', label: '', capacity: 1, sort_order: slotForms.length })">
          <i class="pi pi-plus text-xs" />Add slot
        </button>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showSlotsDialog = false" />
        <Button label="Save slots" icon="pi pi-check" :loading="saving"
          @click="saveSlots" style="background:#1E2157;border-color:#1E2157" />
      </template>
    </Dialog>

  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ bookableId: string; readonly?: boolean }>()
const emit = defineEmits<{ saved: [] }>()

const db = useDb()
const windows = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)

// Window dialog
const showWindowDialog = ref(false)
const editTarget = ref<any>(null)
const winForm = ref<any>({})

// Fixed slots dialog
const showSlotsDialog = ref(false)
const slotWindow = ref<any>(null)
const slotForms = ref<any[]>([])

const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const windowTypes = [
  { value: 'OPEN',    label: 'Open',    desc: 'Book any time in the window' },
  { value: 'SLOTTED', label: 'Slotted', desc: 'Auto-generated equal slots' },
  { value: 'FIXED',   label: 'Fixed',   desc: 'Specific pre-set time slots' },
]

const timeOptions = computed(() => {
  const opts = []
  for (let h = 0; h <= 23; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
      const ampm = h < 12 ? 'am' : 'pm'
      opts.push({ value: val, label: `${h12}:${String(m).padStart(2, '0')}${ampm}` })
    }
  }
  return opts
})

const durationOptions = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
]

function windowTypeBadge(t: string) {
  return {
    OPEN:    'bg-blue-50 text-blue-600',
    SLOTTED: 'bg-purple-50 text-purple-600',
    FIXED:   'bg-amber-50 text-amber-600',
  }[t] ?? 'bg-gray-100 text-gray-500'
}

function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

function formatDays(days: number[]) {
  if (!days || days.length === 7) return 'Every day'
  if (JSON.stringify([...days].sort()) === JSON.stringify([1, 2, 3, 4, 5])) return 'Mon–Fri'
  if (JSON.stringify([...days].sort()) === JSON.stringify([0, 6])) return 'Weekends'
  return days.sort((a, b) => a - b).map(d => dayNames[d]).join(', ')
}

function toggleDay(i: number) {
  const idx = winForm.value.days_of_week.indexOf(i)
  if (idx >= 0) winForm.value.days_of_week.splice(idx, 1)
  else winForm.value.days_of_week.push(i)
}

function openAdd() {
  editTarget.value = null
  winForm.value = {
    name: '', window_type: 'OPEN',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    start_time: '09:00', end_time: '17:00',
    slot_duration_mins: 60, buffer_mins: 0, capacity: 1,
  }
  showWindowDialog.value = true
}

function openEdit(win: any) {
  editTarget.value = win
  winForm.value = {
    name: win.name, window_type: win.window_type,
    days_of_week: [...win.days_of_week],
    start_time: win.start_time.slice(0, 5),
    end_time: win.end_time.slice(0, 5),
    slot_duration_mins: win.slot_duration_mins ?? 60,
    buffer_mins: win.buffer_mins ?? 0,
    capacity: win.capacity ?? 1,
  }
  showWindowDialog.value = true
}

async function saveWindow() {
  saving.value = true
  const payload = {
    bookable_id: props.bookableId,
    name: winForm.value.name,
    window_type: winForm.value.window_type,
    days_of_week: winForm.value.days_of_week,
    start_time: winForm.value.start_time,
    end_time: winForm.value.end_time,
    slot_duration_mins: winForm.value.window_type !== 'FIXED' ? winForm.value.slot_duration_mins : null,
    buffer_mins: winForm.value.buffer_mins,
    capacity: winForm.value.capacity,
    sort_order: editTarget.value?.sort_order ?? windows.value.length,
  }
  if (editTarget.value?.id) {
    await (db.from as any)('booking_windows').update(payload).eq('id', editTarget.value.id)
  } else {
    await (db.from as any)('booking_windows').insert(payload)
  }
  saving.value = false
  showWindowDialog.value = false
  await load()
  emit('saved')
}

async function toggleWindow(win: any) {
  await (db.from as any)('booking_windows').update({ is_active: !win.is_active }).eq('id', win.id)
  await load()
  emit('saved')
}

async function deleteWindow(win: any) {
  if (!confirm(`Delete window "${win.name}"?`)) return
  await (db.from as any)('booking_windows').delete().eq('id', win.id)
  await load()
  emit('saved')
}

// Fixed slots
function openSlots(win: any) {
  slotWindow.value = win
  slotForms.value = (win.slots ?? []).map((s: any) => ({
    id: s.id,
    slot_start: s.slot_start.slice(0, 5),
    slot_end: s.slot_end.slice(0, 5),
    label: s.label ?? '',
    capacity: s.capacity,
    sort_order: s.sort_order,
  }))
  showSlotsDialog.value = true
}

async function saveSlots() {
  if (!slotWindow.value) return
  saving.value = true
  await (db.from as any)('booking_window_slots').delete().eq('window_id', slotWindow.value.id)
  const rows = slotForms.value.map((s, i) => ({
    window_id: slotWindow.value.id,
    slot_start: s.slot_start,
    slot_end: s.slot_end,
    label: s.label || null,
    capacity: s.capacity ?? 1,
    sort_order: i,
  }))
  if (rows.length) await (db.from as any)('booking_window_slots').insert(rows)
  saving.value = false
  showSlotsDialog.value = false
  await load()
  emit('saved')
}

async function load() {
  loading.value = true
  const { data: wData } = await (db.from as any)('booking_windows')
    .select('*, slots:booking_window_slots(*)')
    .eq('bookable_id', props.bookableId)
    .order('sort_order')
  windows.value = (wData ?? []).map((w: any) => ({
    ...w,
    slots: (w.slots ?? []).sort((a: any, b: any) => a.sort_order - b.sort_order),
  }))
  loading.value = false
}

onMounted(load)
</script>
