<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Bookings</h1>
        <p class="text-sm text-surface-500 mt-0.5">Manage bookable resource reservations.</p>
      </div>
      <Button label="New Booking" icon="pi pi-plus" size="small" @click="navigateTo('/bookings/new')" />
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-3 mb-4">
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search bookings…" size="small" class="w-64" />
      </IconField>
      <Select
        v-model="statusFilter"
        :options="statusOptions"
        option-label="label"
        option-value="value"
        placeholder="All statuses"
        size="small"
        class="w-40"
      />
    </div>

    <div class="card">
      <DataTable
        :value="filtered"
        :loading="loading"
        row-hover
        striped-rows
        size="small"
      >
        <template #empty>
          <div class="text-center py-12 text-surface-400">
            <i class="pi pi-book text-3xl mb-3 block" />
            <p>No bookings yet.</p>
          </div>
        </template>

        <Column header="Bookable">
          <template #body="{ data }">
            <div>
              <p class="font-medium text-surface-900">{{ data.bookable?.name ?? '—' }}</p>
              <p class="text-xs text-surface-500">{{ data.bookable?.type }}</p>
            </div>
          </template>
        </Column>

        <Column header="Event / Purpose">
          <template #body="{ data }">
            <span class="text-sm text-surface-700">{{ data.event?.title ?? data.purpose ?? '—' }}</span>
          </template>
        </Column>

        <Column field="start_at" header="Start" style="width:160px">
          <template #body="{ data }">
            <span class="text-sm text-surface-600">{{ data.start_at ? formatDateTime(data.start_at) : '—' }}</span>
          </template>
        </Column>

        <Column field="end_at" header="End" style="width:160px">
          <template #body="{ data }">
            <span class="text-sm text-surface-600">{{ data.end_at ? formatDateTime(data.end_at) : '—' }}</span>
          </template>
        </Column>

        <Column field="status" header="Status" style="width:110px">
          <template #body="{ data }">
            <Tag :value="data.status" :severity="statusSeverity(data.status)" />
          </template>
        </Column>

        <Column style="width:60px">
          <template #body="{ data }">
            <Button
              icon="pi pi-ellipsis-v"
              severity="secondary"
              text
              rounded
              size="small"
              @click.stop="openMenu($event, data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <Menu ref="rowMenu" :model="menuItems" :popup="true" />

    <!-- Create Dialog -->
    <Dialog v-model:visible="showCreate" header="New Booking" modal style="width: 480px">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Bookable</label>
          <Select
            v-model="form.bookable_id"
            :options="bookables"
            option-label="name"
            option-value="id"
            placeholder="Select resource…"
            filter
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Event (optional)</label>
          <Select
            v-model="form.event_id"
            :options="events"
            option-label="title"
            option-value="id"
            placeholder="Link to event…"
            filter
            show-clear
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Purpose</label>
          <InputText v-model="form.purpose" placeholder="e.g. Training session" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Start</label>
            <DatePicker v-model="form.start_at" show-time hour-format="12" class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">End</label>
            <DatePicker v-model="form.end_at" show-time hour-format="12" class="w-full" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" :loading="creating" :disabled="!form.bookable_id" @click="handleCreate" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const bookings = ref<any[]>([])
const bookables = ref<any[]>([])
const events = ref<any[]>([])
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const showCreate = ref(false)
const creating = ref(false)
const rowMenu = ref()
const menuItems = ref<any[]>([])

const form = ref<any>({ bookable_id: '', event_id: null, purpose: '', start_at: null, end_at: null })

const statusOptions = [
  { label: 'All statuses', value: '' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Cancelled', value: 'CANCELLED' },
]

function statusSeverity(s: string) {
  return { CONFIRMED: 'success', PENDING: 'warn', CANCELLED: 'danger', COMPLETED: 'secondary' }[s] ?? 'secondary'
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const filtered = computed(() => bookings.value.filter(b => {
  const q = search.value.toLowerCase()
  const matchSearch = (b.bookable?.name ?? '').toLowerCase().includes(q) ||
    (b.event?.title ?? '').toLowerCase().includes(q) ||
    (b.purpose ?? '').toLowerCase().includes(q)
  const matchStatus = !statusFilter.value || b.status === statusFilter.value
  return matchSearch && matchStatus
}))

async function load() {
  loading.value = true
  const [{ data: bookingData }, { data: bookableData }, { data: eventData }] = await Promise.all([
    db.from('bookings').select('*, bookable:bookables!bookable_id(id,name,type), event:events(id,title)').eq('org_id', orgId.value).order('start_at'),
    db.from('bookables').select('id,name,type').eq('org_id', orgId.value).neq('status', 'DELETED').order('name'),
    db.from('events').select('id,title').eq('org_id', orgId.value).neq('status', 'ARCHIVED').order('title'),
  ])
  bookings.value = bookingData ?? []
  bookables.value = bookableData ?? []
  events.value = eventData ?? []
  loading.value = false
}

async function handleCreate() {
  if (!form.value.bookable_id) return
  creating.value = true
  const { error } = await db.from('bookings').insert({
    org_id: orgId.value,
    bookable_id: form.value.bookable_id,
    event_id: form.value.event_id || null,
    purpose: form.value.purpose || null,
    start_at: form.value.start_at?.toISOString(),
    end_at: form.value.end_at?.toISOString(),
    status: 'CONFIRMED',
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Booking created', life: 3000 })
    showCreate.value = false
    form.value = { bookable_id: '', event_id: null, purpose: '', start_at: null, end_at: null }
    load()
  } else {
    toast.add({ severity: 'error', summary: 'Failed to create booking', life: 3000 })
  }
  creating.value = false
}

function openMenu(event: Event, row: any) {
  menuItems.value = [
    {
      label: row.status === 'CONFIRMED' ? 'Cancel Booking' : 'Confirm Booking',
      icon: row.status === 'CONFIRMED' ? 'pi pi-times' : 'pi pi-check',
      command: async () => {
        const newStatus = row.status === 'CONFIRMED' ? 'CANCELLED' : 'CONFIRMED'
        await db.from('bookings').update({ status: newStatus }).eq('id', row.id).eq('org_id', orgId.value)
        toast.add({ severity: 'success', summary: `Booking ${newStatus.toLowerCase()}`, life: 3000 })
        load()
      }
    },
    { separator: true },
    {
      label: 'Delete',
      icon: 'pi pi-trash',
      class: 'text-red-500',
      command: async () => {
        await db.from('bookings').delete().eq('id', row.id).eq('org_id', orgId.value)
        toast.add({ severity: 'success', summary: 'Booking deleted', life: 3000 })
        load()
      }
    },
  ]
  rowMenu.value.toggle(event)
}

onMounted(load)
</script>
