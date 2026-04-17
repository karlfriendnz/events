<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-surface-900">Finances</h1>
        <p class="text-sm text-surface-500 mt-0.5">Fee components, discounts, and financial reporting.</p>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-4 gap-4 mb-6">
      <div class="card p-4">
        <p class="text-sm text-surface-500 mb-1">Total Events</p>
        <p class="text-2xl font-semibold">{{ summary.events }}</p>
      </div>
      <div class="card p-4">
        <p class="text-sm text-surface-500 mb-1">Fee Components</p>
        <p class="text-2xl font-semibold">{{ summary.feeComponents }}</p>
      </div>
      <div class="card p-4">
        <p class="text-sm text-surface-500 mb-1">Discounts Active</p>
        <p class="text-2xl font-semibold">{{ summary.discounts }}</p>
      </div>
      <div class="card p-4">
        <p class="text-sm text-surface-500 mb-1">Active Add-ons</p>
        <p class="text-2xl font-semibold">{{ summary.addons }}</p>
      </div>
    </div>

    <!-- Tabs -->
    <Tabs v-model:value="activeTab">
      <TabList>
        <Tab value="fees">Fee Components</Tab>
        <Tab value="discounts">Discounts</Tab>
        <Tab value="addons">Add-ons</Tab>
      </TabList>

      <TabPanels>
        <!-- FEE COMPONENTS -->
        <TabPanel value="fees">
          <div class="mt-4">
            <div class="flex items-center gap-3 mb-4">
              <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="feeSearch" placeholder="Search fees…" size="small" class="w-64" />
              </IconField>
            </div>
            <div class="card">
              <DataTable :value="filteredFees" :loading="feesLoading" size="small" striped-rows>
                <template #empty>
                  <div class="text-center py-10 text-surface-400">
                    <i class="pi pi-credit-card text-2xl mb-2 block" />
                    <p>No fee components found.</p>
                  </div>
                </template>
                <Column header="Event">
                  <template #body="{ data }">
                    <NuxtLink :to="`/events/${data.event_id}`" class="text-primary hover:underline text-sm">
                      {{ data.event?.title ?? '—' }}
                    </NuxtLink>
                  </template>
                </Column>
                <Column field="name" header="Fee Name" />
                <Column field="amount" header="Amount" style="width:120px">
                  <template #body="{ data }">
                    <span class="font-medium">{{ formatCurrency(data.amount) }}</span>
                  </template>
                </Column>
                <Column field="xero_code" header="Xero Code" style="width:130px">
                  <template #body="{ data }">
                    <span class="text-surface-500">{{ data.xero_code || '—' }}</span>
                  </template>
                </Column>
                <Column field="is_locked" header="Locked" style="width:80px">
                  <template #body="{ data }">
                    <i :class="data.is_locked ? 'pi pi-lock text-surface-600' : 'pi pi-lock-open text-surface-300'" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <!-- DISCOUNTS -->
        <TabPanel value="discounts">
          <div class="mt-4">
            <div class="flex justify-between mb-4">
              <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="discountSearch" placeholder="Search discounts…" size="small" class="w-64" />
              </IconField>
              <Button label="New Discount" icon="pi pi-plus" size="small" @click="showCreateDiscount = true" />
            </div>
            <div class="card">
              <DataTable :value="filteredDiscounts" :loading="discountsLoading" size="small" striped-rows>
                <template #empty>
                  <div class="text-center py-10 text-surface-400">
                    <i class="pi pi-tag text-2xl mb-2 block" />
                    <p>No discounts yet.</p>
                  </div>
                </template>
                <Column header="Event">
                  <template #body="{ data }">
                    <NuxtLink :to="`/events/${data.event_id}`" class="text-primary hover:underline text-sm">
                      {{ data.event?.title ?? '—' }}
                    </NuxtLink>
                  </template>
                </Column>
                <Column field="name" header="Name" />
                <Column field="type" header="Type" style="width:130px">
                  <template #body="{ data }">
                    <Tag :value="data.type" severity="secondary" />
                  </template>
                </Column>
                <Column field="code" header="Code" style="width:100px">
                  <template #body="{ data }">
                    <code v-if="data.code" class="bg-surface-100 px-1.5 py-0.5 rounded text-xs">{{ data.code }}</code>
                    <span v-else class="text-surface-400">—</span>
                  </template>
                </Column>
                <Column header="Value" style="width:110px">
                  <template #body="{ data }">
                    <span class="font-medium">
                      {{ data.modifier_type === 'PERCENT' ? `${data.modifier_value}%` : formatCurrency(data.modifier_value) }}
                    </span>
                  </template>
                </Column>
                <Column field="expires_at" header="Expires" style="width:130px">
                  <template #body="{ data }">
                    <span class="text-sm text-surface-600">{{ data.expires_at ? formatDate(data.expires_at) : 'Never' }}</span>
                  </template>
                </Column>
                <Column style="width:60px">
                  <template #body="{ data }">
                    <Button icon="pi pi-trash" severity="danger" text rounded size="small"
                      @click="deleteDiscount(data.id)" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>

        <!-- ADD-ONS -->
        <TabPanel value="addons">
          <div class="mt-4">
            <div class="flex justify-between mb-4">
              <h3 class="text-sm font-semibold text-surface-700">Add-ons ({{ addons.length }})</h3>
              <Button label="New Add-on" icon="pi pi-plus" size="small" @click="showCreateAddon = true" />
            </div>
            <div class="card">
              <DataTable :value="addons" :loading="addonsLoading" size="small" striped-rows>
                <template #empty>
                  <div class="text-center py-10 text-surface-400">
                    <i class="pi pi-shopping-bag text-2xl mb-2 block" />
                    <p>No add-ons yet.</p>
                  </div>
                </template>
                <Column header="Event">
                  <template #body="{ data }">
                    <NuxtLink :to="`/events/${data.event_id}`" class="text-primary hover:underline text-sm">
                      {{ data.event?.title ?? '—' }}
                    </NuxtLink>
                  </template>
                </Column>
                <Column field="name" header="Name" />
                <Column field="type" header="Type" style="width:100px">
                  <template #body="{ data }">
                    <Tag :value="data.type" severity="secondary" />
                  </template>
                </Column>
                <Column field="price" header="Price" style="width:100px">
                  <template #body="{ data }">
                    <span class="font-medium">{{ formatCurrency(data.price) }}</span>
                  </template>
                </Column>
                <Column field="stock_limit" header="Stock" style="width:80px">
                  <template #body="{ data }">
                    <span class="text-surface-600">{{ data.stock_limit ?? '∞' }}</span>
                  </template>
                </Column>
                <Column style="width:60px">
                  <template #body="{ data }">
                    <Button icon="pi pi-trash" severity="danger" text rounded size="small"
                      @click="deleteAddon(data.id)" />
                  </template>
                </Column>
              </DataTable>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Create Discount Dialog -->
    <Dialog v-model:visible="showCreateDiscount" header="New Discount" modal style="width: 640px">
      <div class="flex flex-col gap-4 py-1">
        <!-- Event -->
        <div class="grid grid-cols-[160px_1fr] items-center gap-3">
          <label class="text-sm font-medium text-gray-700">Event</label>
          <Select v-model="discountForm.event_id" :options="events" option-label="title" option-value="id"
            placeholder="Select event…" filter class="w-full" />
        </div>
        <!-- Name -->
        <div class="grid grid-cols-[160px_1fr] items-center gap-3">
          <label class="text-sm font-medium text-gray-700">Name</label>
          <InputText v-model="discountForm.name" placeholder="e.g. Early Bird" class="w-full" />
        </div>
        <!-- Type -->
        <div class="grid grid-cols-[160px_1fr] items-center gap-3">
          <label class="text-sm font-medium text-gray-700">Type</label>
          <Select v-model="discountForm.type" :options="['CODE', 'SIBLING', 'ROLE', 'TRAINING_LINKED']" class="w-full" />
        </div>
        <!-- Code -->
        <div class="grid grid-cols-[160px_1fr] items-center gap-3">
          <label class="text-sm font-medium text-gray-700">Code</label>
          <InputText v-model="discountForm.code" placeholder="e.g. EARLY20" class="w-full" />
        </div>
        <!-- Modifier type + value side by side -->
        <div class="grid grid-cols-[160px_1fr] items-center gap-3">
          <label class="text-sm font-medium text-gray-700">Modifier</label>
          <div class="flex gap-2">
            <Select v-model="discountForm.modifier_type" :options="['PERCENT', 'FLAT']" class="w-36 shrink-0" />
            <InputNumber v-model="discountForm.modifier_value" :min="0"
              :prefix="discountForm.modifier_type === 'FLAT' ? '$' : ''"
              :suffix="discountForm.modifier_type === 'PERCENT' ? '%' : ''"
              class="flex-1" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreateDiscount = false" />
        <Button label="Create" :loading="creatingDiscount" :disabled="!discountForm.name || !discountForm.event_id"
          @click="handleCreateDiscount" />
      </template>
    </Dialog>

    <!-- Create Add-on Dialog -->
    <Dialog v-model:visible="showCreateAddon" header="New Add-on" modal style="width: 440px">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Event</label>
          <Select v-model="addonForm.event_id" :options="events" option-label="title" option-value="id"
            placeholder="Select event…" filter class="w-full" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Name</label>
            <InputText v-model="addonForm.name" placeholder="e.g. T-Shirt" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Type</label>
            <Select v-model="addonForm.type" :options="['OBJECT', 'FIELD_VALUE']" class="w-full" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Price</label>
            <InputNumber v-model="addonForm.price" mode="currency" currency="AUD" locale="en-AU" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Stock Limit</label>
            <InputNumber v-model="addonForm.stock_limit" :min="0" placeholder="Unlimited" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Description</label>
          <InputText v-model="addonForm.description" placeholder="Optional" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreateAddon = false" />
        <Button label="Create" :loading="creatingAddon" :disabled="!addonForm.name || !addonForm.event_id"
          @click="handleCreateAddon" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const db = useDb()
const toast = useToast()

const activeTab = ref('fees')
const feeSearch = ref('')
const discountSearch = ref('')

const feeComponents = ref<any[]>([])
const discounts = ref<any[]>([])
const addons = ref<any[]>([])
const events = ref<any[]>([])

const feesLoading = ref(true)
const discountsLoading = ref(false)
const addonsLoading = ref(false)

const showCreateDiscount = ref(false)
const showCreateAddon = ref(false)
const creatingDiscount = ref(false)
const creatingAddon = ref(false)

const discountForm = ref({ event_id: '', name: '', type: 'CODE', code: '', modifier_type: 'PERCENT', modifier_value: 0 })
const addonForm = ref({ event_id: '', name: '', type: 'OBJECT', price: 0, stock_limit: null as number | null, description: '' })

const summary = computed(() => ({
  events: new Set(feeComponents.value.map(f => f.event_id)).size,
  feeComponents: feeComponents.value.length,
  discounts: discounts.value.length,
  addons: addons.value.length,
}))

const filteredFees = computed(() => feeComponents.value.filter(f =>
  (f.name ?? '').toLowerCase().includes(feeSearch.value.toLowerCase()) ||
  (f.event?.title ?? '').toLowerCase().includes(feeSearch.value.toLowerCase())
))

const filteredDiscounts = computed(() => discounts.value.filter(d =>
  (d.name ?? '').toLowerCase().includes(discountSearch.value.toLowerCase()) ||
  (d.event?.title ?? '').toLowerCase().includes(discountSearch.value.toLowerCase())
))

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function load() {
  feesLoading.value = true
  const { DEFAULT_ORG_ID } = await import('~/composables/useDb')
  const [{ data: fees }, { data: disc }, { data: adds }, { data: evts }] = await Promise.all([
    db.from('fee_components').select('*, event:events(id,title)').order('sort_order'),
    db.from('discounts').select('*, event:events(id,title)').order('created_at', { ascending: false }),
    db.from('addons').select('*, event:events(id,title)').order('sort_order'),
    db.from('events').select('id,title').eq('org_id', DEFAULT_ORG_ID).neq('status', 'ARCHIVED').order('title'),
  ])
  feeComponents.value = fees ?? []
  discounts.value = disc ?? []
  addons.value = adds ?? []
  events.value = evts ?? []
  feesLoading.value = false
}

async function handleCreateDiscount() {
  creatingDiscount.value = true
  const { error } = await db.from('discounts').insert({
    event_id: discountForm.value.event_id,
    name: discountForm.value.name,
    type: discountForm.value.type,
    code: discountForm.value.code || null,
    modifier_type: discountForm.value.modifier_type,
    modifier_value: discountForm.value.modifier_value,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Discount created', life: 3000 })
    showCreateDiscount.value = false
    discountForm.value = { event_id: '', name: '', type: 'CODE', code: '', modifier_type: 'PERCENT', modifier_value: 0 }
    load()
  }
  creatingDiscount.value = false
}

async function handleCreateAddon() {
  creatingAddon.value = true
  const { error } = await db.from('addons').insert({
    event_id: addonForm.value.event_id,
    name: addonForm.value.name,
    type: addonForm.value.type,
    price: addonForm.value.price,
    stock_limit: addonForm.value.stock_limit,
    description: addonForm.value.description || null,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Add-on created', life: 3000 })
    showCreateAddon.value = false
    addonForm.value = { event_id: '', name: '', type: 'OBJECT', price: 0, stock_limit: null, description: '' }
    load()
  }
  creatingAddon.value = false
}

async function deleteDiscount(id: string) {
  await db.from('discounts').delete().eq('id', id)
  toast.add({ severity: 'success', summary: 'Discount deleted', life: 3000 })
  load()
}

async function deleteAddon(id: string) {
  await db.from('addons').delete().eq('id', id)
  toast.add({ severity: 'success', summary: 'Add-on deleted', life: 3000 })
  load()
}

onMounted(load)
</script>
