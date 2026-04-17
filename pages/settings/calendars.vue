<template>
  <div class="p-6 max-w-3xl">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">Calendars</h2>
        <p class="text-sm text-gray-500 mt-0.5">Create named calendars to organise events into groups.</p>
      </div>
      <Button label="New Calendar" icon="pi pi-plus" size="small" @click="openCreate" style="background:#1E2157; border-color:#1E2157" />
    </div>

    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div v-if="loading" class="p-8 flex justify-center">
        <i class="pi pi-spin pi-spinner text-2xl text-gray-400" />
      </div>
      <div v-else-if="!calendars.length" class="text-center py-12 text-gray-400">
        <i class="pi pi-calendar text-3xl mb-3 block" />
        <p class="text-sm">No calendars yet. Create one to start organising events.</p>
      </div>
      <div v-else class="divide-y divide-gray-100">
        <div
          v-for="cal in calendars"
          :key="cal.id"
          class="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 group"
        >
          <!-- Color dot + icon -->
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            :style="{ background: cal.color ?? '#1E2157' }"
          >
            <i :class="`pi ${cal.icon ?? 'pi-calendar'} text-white text-sm`" />
          </div>

          <!-- Name + event count -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900">{{ cal.name }}</p>
            <p class="text-xs text-gray-400">{{ cal._count ?? 0 }} events</p>
          </div>

          <!-- Color preview -->
          <div
            class="w-4 h-4 rounded-full border border-gray-200"
            :style="{ background: cal.color ?? '#94a3b8' }"
          />

          <!-- Actions -->
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openEdit(cal)" />
            <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteCalendar(cal)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <Dialog v-model:visible="showDialog" :header="editing ? 'Edit Calendar' : 'New Calendar'" modal style="width:400px">
      <div class="flex flex-col gap-4 py-1">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="form.name" autofocus placeholder="e.g. Training, Games, Social" />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Colour</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in colorPalette"
              :key="color"
              class="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              :class="form.color === color ? 'border-gray-900 scale-110' : 'border-transparent'"
              :style="{ background: color }"
              @click="form.color = color"
            />
            <div class="flex items-center gap-1.5">
              <input
                type="color"
                v-model="form.color"
                class="w-7 h-7 rounded cursor-pointer border border-gray-200"
              />
              <span class="text-xs text-gray-500">Custom</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium">Icon</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="icon in iconOptions"
              :key="icon"
              class="w-8 h-8 rounded-lg border flex items-center justify-center text-sm transition-colors"
              :class="form.icon === icon
                ? 'border-[#1E2157] bg-[#EFF6FF] text-[#1E2157]'
                : 'border-gray-200 text-gray-500 hover:border-gray-400'"
              :title="icon"
              @click="form.icon = icon"
            >
              <i :class="`pi pi-${icon}`" />
            </button>
          </div>
        </div>

        <!-- Preview -->
        <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div
            class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            :style="{ background: form.color || '#1E2157' }"
          >
            <i :class="`pi pi-${form.icon || 'calendar'} text-white text-sm`" />
          </div>
          <span class="text-sm font-medium text-gray-700">{{ form.name || 'Calendar name' }}</span>
        </div>
      </div>

      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showDialog = false" />
        <Button
          :label="editing ? 'Save' : 'Create'"
          :loading="saving"
          :disabled="!form.name.trim()"
          @click="handleSave"
          style="background:#1E2157; border-color:#1E2157"
        />
      </template>
    </Dialog>

    <ConfirmDialog />
    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'

const db = useDb()
const toast = useToast()
const confirm = useConfirm()
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000002'

const calendars = ref<any[]>([])
const loading = ref(true)
const showDialog = ref(false)
const saving = ref(false)
const editing = ref<any>(null)

const form = reactive({
  name: '',
  color: '#1E2157',
  icon: 'calendar',
})

const colorPalette = [
  '#1E2157', '#3B82F6', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#10B981', '#06B6D4',
  '#6B7280', '#1EA97C', '#F97316', '#84CC16',
]

const iconOptions = [
  'calendar', 'users', 'trophy', 'bolt', 'flag',
  'star', 'heart', 'tag', 'briefcase', 'home',
  'map-marker', 'clock', 'shield', 'book', 'graduation-cap',
]

async function load() {
  loading.value = true
  const { data } = await db
    .from('categories')
    .select('*, events:events(id)')
    .eq('org_id', DEFAULT_ORG_ID)
    .order('sort_order')
    .order('name')
  calendars.value = (data ?? []).map((c: any) => ({
    ...c,
    _count: c.events?.length ?? 0,
  }))
  loading.value = false
}

function openCreate() {
  editing.value = null
  form.name = ''
  form.color = '#1E2157'
  form.icon = 'calendar'
  showDialog.value = true
}

function openEdit(cal: any) {
  editing.value = cal
  form.name = cal.name
  form.color = cal.color ?? '#1E2157'
  form.icon = cal.icon ?? 'calendar'
  showDialog.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const payload = {
      org_id: DEFAULT_ORG_ID,
      name: form.name.trim(),
      color: form.color,
      icon: `pi-${form.icon}`,
    }
    if (editing.value) {
      const { error } = await db.from('categories').update(payload).eq('id', editing.value.id)
      if (error) throw error
      toast.add({ severity: 'success', summary: 'Calendar updated', life: 3000 })
    } else {
      const { error } = await db.from('categories').insert(payload)
      if (error) throw error
      toast.add({ severity: 'success', summary: 'Calendar created', life: 3000 })
    }
    showDialog.value = false
    load()
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Failed to save', detail: err?.message, life: 4000 })
  }
  saving.value = false
}

function deleteCalendar(cal: any) {
  confirm.require({
    message: `Delete "${cal.name}"? Events using this calendar won't be deleted, just unassigned.`,
    header: 'Delete Calendar',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: async () => {
      await db.from('categories').delete().eq('id', cal.id)
      toast.add({ severity: 'success', summary: 'Calendar deleted', life: 3000 })
      load()
    },
  })
}

onMounted(load)
</script>
