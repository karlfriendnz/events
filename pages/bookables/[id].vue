<template>
  <div class="p-6">
    <!-- Back link -->
    <NuxtLink to="/bookables" class="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1 mb-5">
      <i class="pi pi-chevron-left text-xs" /> Bookables
    </NuxtLink>

    <!-- Header skeleton -->
    <div v-if="loading" class="flex items-center gap-3 mb-6">
      <Skeleton width="240px" height="28px" />
      <Skeleton width="70px" height="24px" />
    </div>

    <!-- Header -->
    <div v-else-if="venue" class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <!-- Colour dot -->
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-[#1E2157] shrink-0">
          <i :class="`pi ${venue.icon ?? 'pi-building'} text-white`" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-semibold text-gray-900">{{ venue.name }}</h1>
            <Tag :value="venue.status" :severity="statusSeverity(venue.status)" />
          </div>
          <p v-if="parentVenue" class="text-sm text-gray-400 mt-0.5">
            <i class="pi pi-arrow-up text-xs mr-1" />
            <NuxtLink :to="`/bookables/${parentVenue.id}`" class="hover:underline">{{ parentVenue.name }}</NuxtLink>
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <Button
          label="Add Sub-venue"
          icon="pi pi-sitemap"
          severity="secondary"
          outlined
          size="small"
          @click="navigateTo(`/bookables/new?parentId=${venue.id}&parentName=${encodeURIComponent(venue.name)}`)"
        />
        <Button label="Edit" icon="pi pi-pencil" severity="secondary" size="small" @click="showEdit = true" />
        <Button icon="pi pi-ellipsis-v" severity="secondary" text size="small" @click="e => moreMenu.toggle(e)" />
        <Menu ref="moreMenu" :model="moreMenuItems" :popup="true" />
      </div>
    </div>

    <!-- Tabs -->
    <Tabs v-if="venue" v-model:value="activeTab">
      <TabList>
        <Tab value="details">Details</Tab>
        <Tab value="sub-venues">Sub-venues ({{ children.length }})</Tab>
        <Tab value="photos">Photos</Tab>
        <Tab value="availability">Availability</Tab>
        <Tab value="billing">Billing</Tab>
        <Tab value="bookings">Upcoming Bookings</Tab>
      </TabList>

      <TabPanels>
        <!-- DETAILS -->
        <TabPanel value="details">
          <div class="mt-4 grid grid-cols-3 gap-6">
            <div class="col-span-2 space-y-4">
              <div class="bg-white rounded-xl border border-gray-100 p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-4">Venue Details</h3>
                <dl class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <div>
                    <dt class="text-gray-400 text-xs mb-0.5">Name</dt>
                    <dd class="font-medium text-gray-900">{{ venue.name }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 text-xs mb-0.5">Internal Name</dt>
                    <dd>{{ venue.internal_name || '—' }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 text-xs mb-0.5">Type</dt>
                    <dd><Tag :value="venue.type" severity="info" /></dd>
                  </div>
                  <div>
                    <dt class="text-gray-400 text-xs mb-0.5">Max Capacity</dt>
                    <dd>{{ venue.max_concurrent || '—' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-gray-400 text-xs mb-0.5">Address</dt>
                    <dd>{{ venue.location || '—' }}</dd>
                  </div>
                  <div class="col-span-2">
                    <dt class="text-gray-400 text-xs mb-0.5">Description</dt>
                    <dd class="whitespace-pre-wrap text-gray-700">{{ venue.description || '—' }}</dd>
                  </div>
                  <div v-if="venue.features" class="col-span-2">
                    <dt class="text-gray-400 text-xs mb-0.5">Features</dt>
                    <dd class="whitespace-pre-wrap text-gray-700">{{ venue.features }}</dd>
                  </div>
                  <div v-if="venue.rules" class="col-span-2">
                    <dt class="text-gray-400 text-xs mb-0.5">Rules</dt>
                    <dd class="whitespace-pre-wrap text-gray-700">{{ venue.rules }}</dd>
                  </div>
                </dl>
              </div>

              <!-- Layouts -->
              <div v-if="layouts.length" class="bg-white rounded-xl border border-gray-100 p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Layout Options</h3>
                <div class="grid grid-cols-3 gap-3">
                  <div
                    v-for="layout in layouts"
                    :key="layout.name"
                    class="p-3 border border-gray-100 rounded-lg text-center"
                  >
                    <i class="pi pi-table text-gray-300 text-2xl mb-1 block" />
                    <p class="text-sm font-medium text-gray-800">{{ layout.name }}</p>
                    <p v-if="layout.capacity" class="text-xs text-gray-400">Up to {{ layout.capacity }} people</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Sidebar -->
            <div class="space-y-4">
              <div class="bg-white rounded-xl border border-gray-100 p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Settings</h3>
                <ul class="space-y-2 text-sm text-gray-600">
                  <li class="flex items-center gap-2">
                    <i :class="venue.is_public ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-gray-300'" />
                    Publicly bookable
                  </li>
                  <li class="flex items-center gap-2">
                    <i :class="venue.show_location ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-gray-300'" />
                    Show location
                  </li>
                </ul>
              </div>

              <!-- Categories/Sports -->
              <div v-if="venue.sports?.length" class="bg-white rounded-xl border border-gray-100 p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Categories</h3>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="sport in venue.sports"
                    :key="sport"
                    class="text-xs bg-[#EFF6FF] text-[#1E2157] px-2.5 py-1 rounded-full font-medium"
                  >{{ sport }}</span>
                </div>
              </div>

              <!-- Billing summary -->
              <div v-if="billing?.hourly_rate != null" class="bg-white rounded-xl border border-gray-100 p-5">
                <h3 class="text-sm font-semibold text-gray-700 mb-3">Billing</h3>
                <dl class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <dt class="text-gray-400">Hourly rate</dt>
                    <dd class="font-medium">{{ formatCurrency(billing.hourly_rate) }}</dd>
                  </div>
                  <div v-if="billing.bond != null" class="flex justify-between">
                    <dt class="text-gray-400">Bond</dt>
                    <dd>{{ formatCurrency(billing.bond) }}</dd>
                  </div>
                  <div class="flex justify-between">
                    <dt class="text-gray-400">GST</dt>
                    <dd>{{ billing.gst ? 'Applicable' : 'Not applicable' }}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- SUB-VENUES -->
        <TabPanel value="sub-venues">
          <div class="mt-4">
            <div class="flex justify-between mb-4">
              <h3 class="text-sm font-semibold text-gray-700">Sub-venues</h3>
              <Button
                label="Add Sub-venue"
                icon="pi pi-plus"
                size="small"
                @click="navigateTo(`/bookables/new?parentId=${venue.id}&parentName=${encodeURIComponent(venue.name)}`)"
                style="background:#1E2157; border-color:#1E2157"
              />
            </div>
            <div v-if="!children.length" class="text-center py-12 text-gray-400">
              <i class="pi pi-sitemap text-3xl mb-3 block" />
              <p class="text-sm">No sub-venues yet.</p>
              <Button
                label="Add Sub-venue"
                icon="pi pi-plus"
                size="small"
                class="mt-3"
                @click="navigateTo(`/bookables/new?parentId=${venue.id}&parentName=${encodeURIComponent(venue.name)}`)"
              />
            </div>
            <div v-else class="grid grid-cols-3 gap-4">
              <NuxtLink
                v-for="child in children"
                :key="child.id"
                :to="`/bookables/${child.id}`"
                class="bg-white border border-gray-200 rounded-xl p-4 hover:border-[#1E2157] hover:shadow-sm transition-all"
              >
                <div class="flex items-center gap-3 mb-2">
                  <div class="w-8 h-8 rounded-lg bg-[#1E2157] flex items-center justify-center shrink-0">
                    <i class="pi pi-building text-white text-xs" />
                  </div>
                  <p class="font-medium text-gray-900 text-sm">{{ child.name }}</p>
                </div>
                <div class="flex items-center gap-2 text-xs text-gray-400">
                  <i class="pi pi-users" />
                  <span>Capacity {{ child.max_concurrent || '—' }}</span>
                </div>
                <div v-if="child.location" class="text-xs text-gray-400 mt-1">
                  <i class="pi pi-map-marker mr-1" />{{ child.location }}
                </div>
              </NuxtLink>
            </div>
          </div>
        </TabPanel>

        <!-- PHOTOS -->
        <TabPanel value="photos">
          <div class="mt-4">
            <div class="flex justify-between mb-4">
              <h3 class="text-sm font-semibold text-gray-700">Photos</h3>
              <Button label="Upload" icon="pi pi-upload" severity="secondary" size="small" @click="triggerFileInput" />
            </div>
            <div v-if="!venue.images?.length" class="text-center py-12 text-gray-400">
              <i class="pi pi-image text-3xl mb-3 block" />
              <p class="text-sm">No photos uploaded.</p>
            </div>
            <div v-else class="grid grid-cols-4 gap-4">
              <div
                v-for="(img, i) in venue.images"
                :key="i"
                class="aspect-square rounded-xl overflow-hidden border border-gray-200 relative group"
              >
                <img :src="img.url" class="w-full h-full object-cover" />
                <button
                  class="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  @click="removePhoto(i)"
                >
                  <i class="pi pi-trash" />
                </button>
              </div>
            </div>
            <input ref="fileInputRef" type="file" accept="image/*" multiple class="hidden" @change="handlePhotoUpload" />
          </div>
        </TabPanel>

        <!-- AVAILABILITY -->
        <TabPanel value="availability">
          <div class="mt-4 max-w-lg">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Weekly Availability</h3>
            <div class="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              <div
                v-for="day in weekDays"
                :key="day.value"
                class="flex items-center gap-4 px-5 py-3"
              >
                <span class="w-24 text-sm text-gray-700 shrink-0">{{ day.label }}</span>
                <template v-if="availability[day.value]?.enabled">
                  <span class="text-sm text-gray-900 font-medium">{{ formatTime(availability[day.value].open) }}</span>
                  <span class="text-gray-400">—</span>
                  <span class="text-sm text-gray-900 font-medium">{{ formatTime(availability[day.value].close) }}</span>
                </template>
                <span v-else class="text-sm text-gray-400 italic">Closed</span>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- BILLING -->
        <TabPanel value="billing">
          <div class="mt-4 max-w-lg">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Billing Configuration</h3>

            <!-- Pricing tiers -->
            <div class="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-gray-700">Pricing Tiers</h4>
                <Button label="Add Tier" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addPricingTier" />
              </div>
              <div
                v-for="(tier, i) in pricingTiers"
                :key="i"
                class="p-4 border border-gray-100 rounded-lg flex flex-col gap-3"
              >
                <div class="flex items-center gap-3">
                  <InputText v-model="tier.name" placeholder="Group name (e.g. Seniors, Juniors)" class="flex-1" size="small" />
                  <Button icon="pi pi-trash" severity="danger" text size="small" @click="pricingTiers.splice(i, 1)" />
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs text-gray-500">Rate per hour</label>
                    <InputNumber v-model="tier.per_hour" mode="currency" currency="AUD" locale="en-AU" size="small" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs text-gray-500">Rate per person</label>
                    <InputNumber v-model="tier.per_person" mode="currency" currency="AUD" locale="en-AU" size="small" />
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-gray-500">Minimum booking (hrs)</label>
                  <InputNumber v-model="tier.min_hours" :min="0.5" :step="0.5" :min-fraction-digits="1" size="small" class="w-36" />
                </div>
              </div>
              <div v-if="!pricingTiers.length" class="text-center py-6 text-gray-400 text-sm">
                No pricing tiers. Add one above.
              </div>

              <Divider />

              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-gray-500">Bond amount</label>
                  <InputNumber v-model="billing.bond" mode="currency" currency="AUD" locale="en-AU" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-gray-500">Xero account code</label>
                  <InputText v-model="billing.xero_code" placeholder="e.g. 200" />
                </div>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700">GST applicable</span>
                <ToggleSwitch v-model="billing.gst" />
              </div>

              <div class="flex justify-end">
                <Button label="Save Billing" size="small" @click="saveBilling" style="background:#1E2157; border-color:#1E2157" />
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- BOOKINGS -->
        <TabPanel value="bookings">
          <div class="mt-4">
            <h3 class="text-sm font-semibold text-gray-700 mb-4">Upcoming Bookings</h3>
            <div class="bg-white rounded-xl border border-gray-100">
              <DataTable :value="bookings" size="small" :loading="bookingsLoading">
                <template #empty>
                  <div class="text-center py-8 text-gray-400">
                    <i class="pi pi-calendar text-2xl mb-2 block" />
                    <p>No upcoming bookings.</p>
                  </div>
                </template>
                <Column header="Event">
                  <template #body="{ data }">
                    <NuxtLink :to="`/events/${data.event_id}`" class="text-[#1E2157] hover:underline font-medium text-sm">
                      {{ data.event?.title ?? 'Unknown event' }}
                    </NuxtLink>
                  </template>
                </Column>
                <Column header="Date" style="width:180px">
                  <template #body="{ data }">
                    <span class="text-sm text-gray-600">{{ data.starts_at ? formatDT(data.starts_at) : '—' }}</span>
                  </template>
                </Column>
                <Column field="status" header="Status" style="width:110px">
                  <template #body="{ data }">
                    <Tag :value="data.status" severity="secondary" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Edit Dialog -->
    <Dialog v-model:visible="showEdit" header="Edit Venue" modal style="width:480px">
      <div class="flex flex-col gap-4" v-if="editForm">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="editForm.name" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Status</label>
          <Select v-model="editForm.status" :options="['ACTIVE', 'DRAFT', 'ARCHIVED']" class="w-full" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Address</label>
          <InputText v-model="editForm.location" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Max Capacity</label>
          <InputNumber v-model="editForm.max_concurrent" :min="0" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Description</label>
          <Textarea v-model="editForm.description" rows="3" auto-resize />
        </div>
        <div class="flex items-center gap-3">
          <Checkbox v-model="editForm.is_public" :binary="true" />
          <label class="text-sm">Publicly bookable</label>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showEdit = false" />
        <Button label="Save" :loading="saving" @click="saveEdit" style="background:#1E2157; border-color:#1E2157" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()
const route = useRoute()
const id = route.params.id as string

const venue = ref<any>(null)
const parentVenue = ref<any>(null)
const children = ref<any[]>([])
const loading = ref(true)
const saving = ref(false)
const showEdit = ref(false)
const editForm = ref<any>(null)
const activeTab = ref('details')
const moreMenu = ref()
const fileInputRef = ref<HTMLInputElement | null>(null)

const bookings = ref<any[]>([])
const bookingsLoading = ref(false)

const weekDays = [
  { label: 'Monday', value: 'mon' }, { label: 'Tuesday', value: 'tue' },
  { label: 'Wednesday', value: 'wed' }, { label: 'Thursday', value: 'thu' },
  { label: 'Friday', value: 'fri' }, { label: 'Saturday', value: 'sat' },
  { label: 'Sunday', value: 'sun' },
]

const moreMenuItems = computed(() => [
  {
    label: 'Archive',
    icon: 'pi pi-trash',
    class: 'text-red-500',
    command: async () => {
      await db.from('bookables').update({ status: 'ARCHIVED' }).eq('id', id)
      toast.add({ severity: 'success', summary: 'Archived', life: 3000 })
      navigateTo('/bookables')
    }
  }
])

// Custom fields unpacked
const customFields = computed(() => venue.value?.custom_fields ?? {})
const availability = computed(() => customFields.value.availability ?? {})
const billing = ref({ hourly_rate: null as number | null, bond: null as number | null, gst: true, xero_code: '', min_hours: 1 })
const pricingTiers = ref<any[]>([])
const layouts = computed(() => customFields.value.layouts ?? [])

function statusSeverity(s: string) {
  return { ACTIVE: 'success', DRAFT: 'secondary', ARCHIVED: 'warn', DELETED: 'danger' }[s] ?? 'secondary'
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n ?? 0)
}

function formatTime(t: any) {
  if (!t) return '—'
  if (typeof t === 'string') return t
  return new Date(t).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

function formatDT(d: string) {
  return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function addPricingTier() {
  pricingTiers.value.push({ name: '', per_hour: null, per_person: null, min_hours: 1 })
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handlePhotoUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  const current = [...(venue.value.images ?? [])]
  for (const file of Array.from(files)) {
    current.push({ url: URL.createObjectURL(file), name: file.name })
  }
  await db.from('bookables').update({ images: current }).eq('id', id)
  venue.value.images = current
}

async function removePhoto(i: number) {
  const imgs = [...(venue.value.images ?? [])]
  imgs.splice(i, 1)
  await db.from('bookables').update({ images: imgs }).eq('id', id)
  venue.value.images = imgs
}

async function saveBilling() {
  const custom = { ...customFields.value, billing: { ...billing.value, pricing_tiers: pricingTiers.value } }
  await db.from('bookables').update({ custom_fields: custom }).eq('id', id)
  toast.add({ severity: 'success', summary: 'Billing saved', life: 3000 })
}

async function loadVenue() {
  loading.value = true
  const { data } = await db.from('bookables').select('*').eq('id', id).single()
  venue.value = data
  if (data?.custom_fields?.billing) {
    const b = data.custom_fields.billing
    billing.value = { hourly_rate: b.hourly_rate, bond: b.bond, gst: b.gst ?? true, xero_code: b.xero_code ?? '', min_hours: b.min_hours ?? 1 }
    pricingTiers.value = b.pricing_tiers ?? []
  }
  if (data?.parent_id) {
    const { data: parent } = await db.from('bookables').select('id, name').eq('id', data.parent_id).single()
    parentVenue.value = parent
  }
  editForm.value = { name: data.name, status: data.status, location: data.location, max_concurrent: data.max_concurrent, description: data.description, is_public: data.is_public }
  loading.value = false
}

async function loadChildren() {
  const { data } = await db.from('bookables').select('*').eq('parent_id', id).neq('status', 'DELETED').order('name')
  children.value = data ?? []
}

async function loadBookings() {
  bookingsLoading.value = true
  const { data } = await db
    .from('bookings')
    .select('*, event:events(id, title)')
    .eq('bookable_id', id)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(20)
  bookings.value = data ?? []
  bookingsLoading.value = false
}

async function saveEdit() {
  saving.value = true
  const { error } = await db.from('bookables').update({
    name: editForm.value.name,
    status: editForm.value.status,
    location: editForm.value.location,
    max_concurrent: editForm.value.max_concurrent,
    description: editForm.value.description,
    is_public: editForm.value.is_public,
  }).eq('id', id)
  if (!error) {
    toast.add({ severity: 'success', summary: 'Saved', life: 3000 })
    showEdit.value = false
    loadVenue()
  }
  saving.value = false
}

watch(activeTab, tab => {
  if (tab === 'bookings' && !bookings.value.length) loadBookings()
})

onMounted(async () => {
  await loadVenue()
  loadChildren()
})
</script>
