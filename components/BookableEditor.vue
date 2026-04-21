<template>
  <div class="flex flex-col h-full">

    <!-- Tab bar (hidden in standalone mode — parent renders pill tabs) -->
    <div v-if="!standalone" class="flex items-center gap-1 px-4 pt-3 pb-0 bg-white border-b border-gray-200 shrink-0">
      <button
        v-for="tab in tabs" :key="tab.key"
        class="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
        :class="activeTab === tab.key
          ? 'border-[#1E2157] text-[#1E2157]'
          : 'border-transparent text-gray-500 hover:text-gray-800'"
        @click="activeTab = tab.key">
        <i :class="`pi ${tab.icon} text-xs`" />
        {{ tab.label }}
      </button>
    </div>

    <!-- Tab content -->
    <div class="flex-1 overflow-y-auto">

      <!-- Details tab -->
      <div v-if="activeTab === 'details'" class="p-6">
        <div class="flex gap-6 items-start">
        <div class="flex-1 min-w-0 space-y-5 basis-1/2">
        <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

          <div class="flex items-center px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Name</span>
            <InputText v-model="form.name" placeholder="e.g. Field 1" class="flex-1" />
          </div>

          <div class="flex items-center px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Internal name</span>
            <InputText v-model="form.internal_name" placeholder="Optional internal reference" class="flex-1" />
          </div>

          <div class="flex items-start px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-32 shrink-0 pt-1">Description</span>
            <Textarea v-model="form.description" placeholder="Describe this venue…" auto-resize rows="3" class="flex-1 text-sm" />
          </div>

          <div class="flex items-center px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-32 shrink-0">Location</span>
            <InputText v-model="form.location" placeholder="Street address or area" class="flex-1" />
          </div>

          <div class="flex items-start px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-32 shrink-0 pt-1">Sports</span>
            <div class="flex-1 flex flex-wrap gap-2">
              <div v-for="(sport, i) in form.sports" :key="i" class="flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-sm text-gray-700">
                <span>{{ sport }}</span>
                <button type="button" class="text-gray-400 hover:text-red-500" @click="form.sports.splice(i, 1)">
                  <i class="pi pi-times text-xs" />
                </button>
              </div>
              <input v-model="newSport" type="text" placeholder="Add sport…"
                class="text-sm text-gray-700 bg-transparent border-0 outline-none placeholder-gray-400 min-w-24"
                @keydown.enter.prevent="addSport"
                @keydown.comma.prevent="addSport" />
            </div>
          </div>

          <div class="flex items-start px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-32 shrink-0 pt-1">Features</span>
            <div class="flex-1 flex flex-wrap gap-2">
              <div v-for="(feat, i) in form.features" :key="i" class="flex items-center gap-1 bg-blue-50 text-blue-700 rounded-full px-3 py-1 text-sm">
                <span>{{ feat }}</span>
                <button type="button" class="text-blue-400 hover:text-red-500" @click="form.features.splice(i, 1)">
                  <i class="pi pi-times text-xs" />
                </button>
              </div>
              <input v-model="newFeature" type="text" placeholder="Add feature…"
                class="text-sm text-gray-700 bg-transparent border-0 outline-none placeholder-gray-400 min-w-24"
                @keydown.enter.prevent="addFeature"
                @keydown.comma.prevent="addFeature" />
            </div>
          </div>

          <div class="flex justify-end px-5 py-3">
            <Button label="Save" icon="pi pi-check" size="small" :loading="saving" @click="save" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>

        <!-- Settings inline -->
        <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Status</p>
              <p class="text-xs text-gray-500 mt-0.5">Archive to hide from booking</p>
            </div>
            <Select v-model="form.status" :options="statusOptions" option-label="label" option-value="value" size="small" class="w-36" @update:modelValue="save" />
          </div>

          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Public</p>
              <p class="text-xs text-gray-500 mt-0.5">Visible to members on public pages</p>
            </div>
            <ToggleSwitch v-model="form.is_public" @update:modelValue="save" />
          </div>

          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Show in menu</p>
              <p class="text-xs text-gray-500 mt-0.5">Add a quick link to this venue's bookings in the sidebar</p>
            </div>
            <ToggleSwitch v-model="form.show_in_menu" @update:modelValue="onShowInMenuToggle" />
          </div>

          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Default bookings view</p>
              <p class="text-xs text-gray-500 mt-0.5">Calendar view shown when opening the Bookings tab</p>
            </div>
            <Select v-model="form.default_booking_view" :options="bookingViewOptions"
              option-label="label" option-value="value" size="small" class="w-36" @update:modelValue="save" />
          </div>

          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Multiple layouts</p>
              <p class="text-xs text-gray-500 mt-0.5">Allow this venue to have more than one layout</p>
            </div>
            <ToggleSwitch v-model="form.allow_multiple_layouts" @update:modelValue="save" />
          </div>

          <div v-if="props.bookable?.master_id" class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Master template</p>
              <p class="text-xs text-gray-500 mt-0.5">Inherit details, pricing and rules from another bookable</p>
            </div>
            <Select v-model="form.master_id" :options="masterOptions" option-label="name" option-value="id"
              placeholder="No master" size="small" class="w-52" show-clear @update:modelValue="save" />
          </div>

          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Venue role</p>
              <p class="text-xs text-gray-500 mt-0.5">Standalone venue, or part of a master/linked group</p>
            </div>
            <div class="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium bg-white">
              <button class="px-3 py-1.5 transition-colors"
                :class="!props.bookable?.is_master && !props.bookable?.master_id ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                @click="emit('set-role', 'standalone')">Standalone</button>
              <button class="px-3 py-1.5 transition-colors border-l border-gray-200 flex items-center gap-1"
                :class="props.bookable?.is_master ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                @click="emit('set-role', 'master')">
                <i class="pi pi-crown text-[9px]" /> Master
              </button>
              <button class="px-3 py-1.5 transition-colors border-l border-gray-200 flex items-center gap-1"
                :class="props.bookable?.master_id ? 'bg-[#1E2157] text-white' : 'text-gray-500 hover:bg-gray-50'"
                @click="emit('set-role', 'linked')">
                <i class="pi pi-link text-[9px]" /> Linked
              </button>
            </div>
          </div>

        </div>

        <!-- Temporary closure -->
        <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div class="flex items-center justify-between px-5 py-4">
            <div>
              <p class="text-sm font-semibold text-gray-800">Temporarily closed</p>
              <p class="text-xs text-gray-500 mt-0.5">Block all bookings for a date range</p>
            </div>
            <ToggleSwitch v-model="form.isTempClosed" @update:modelValue="onTempClosedToggle" />
          </div>
          <template v-if="form.isTempClosed">
            <div class="flex items-center px-5 py-4 gap-6">
              <span class="text-sm text-gray-600 w-28 shrink-0">From</span>
              <DatePicker v-model="form.closed_from" placeholder="Start date" date-format="D d M yy" size="small" class="flex-1" show-button-bar />
            </div>
            <div class="flex items-center px-5 py-4 gap-6">
              <span class="text-sm text-gray-600 w-28 shrink-0">Until</span>
              <DatePicker v-model="form.closed_until" placeholder="End date (optional)" date-format="D d M yy" size="small" class="flex-1" show-button-bar />
            </div>
            <div class="flex items-center px-5 py-4 gap-6">
              <span class="text-sm text-gray-600 w-28 shrink-0">Reason</span>
              <InputText v-model="form.closure_reason" placeholder="e.g. Maintenance, Renovation" class="flex-1" size="small" />
            </div>
            <div class="px-5 py-3 flex justify-end">
              <Button label="Save closure" icon="pi pi-check" size="small" :loading="saving" @click="save" style="background:#1E2157;border-color:#1E2157" />
            </div>
          </template>
        </div>

        </div><!-- end left col -->

        <!-- Photos — right column -->
        <div class="basis-1/2 min-w-0">
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p class="text-sm font-semibold text-gray-800">Photos</p>
              <label class="flex items-center gap-1.5 text-xs text-[#1E2157] hover:underline cursor-pointer">
                <i class="pi pi-upload text-xs" />
                Add
                <input type="file" accept="image/*" multiple class="hidden" :disabled="uploadingPhoto" @change="handlePhotoUpload" />
              </label>
            </div>
            <div v-if="!form.images?.length && !uploadingPhoto" class="px-4 py-8 text-center text-sm text-gray-400">
              <i class="pi pi-image text-2xl block mb-2 text-gray-300" />
              No photos yet
            </div>
            <div v-else class="p-3 grid grid-cols-3 gap-2">
              <div v-for="(url, i) in form.images" :key="i" class="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img :src="url" class="w-full h-full object-cover" />

                <!-- Role badges -->
                <div class="absolute top-1.5 left-1.5 flex gap-1">
                  <span v-if="form.main_image === url"
                    class="text-xs font-semibold px-2 py-1 rounded bg-[#1E2157] text-white leading-none shadow">
                    Main
                  </span>
                  <span v-if="form.sponsor_image === url"
                    class="text-xs font-semibold px-2 py-1 rounded bg-amber-500 text-white leading-none shadow">
                    Sponsor
                  </span>
                </div>

                <!-- Hover actions -->
                <div class="absolute inset-x-0 bottom-0 flex items-center justify-between px-1.5 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div class="flex gap-1">
                    <button
                      class="text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none transition-colors"
                      :class="form.main_image === url ? 'bg-[#1E2157] text-white' : 'bg-black/60 text-white hover:bg-[#1E2157]'"
                      @click="setImageRole(url, 'main')"
                      title="Set as main image">
                      Main
                    </button>
                    <button
                      class="text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none transition-colors"
                      :class="form.sponsor_image === url ? 'bg-amber-500 text-white' : 'bg-black/60 text-white hover:bg-amber-500'"
                      @click="setImageRole(url, 'sponsor')"
                      title="Set as sponsor image">
                      Sponsor
                    </button>
                  </div>
                  <button
                    class="w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                    @click="removePhoto(i)">
                    <i class="pi pi-times text-[9px]" />
                  </button>
                </div>
              </div>
              <div v-if="uploadingPhoto" class="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                <i class="pi pi-spin pi-spinner text-gray-400 text-sm" />
              </div>
            </div>
          </div>
        </div>

        </div><!-- end flex row -->
      </div>

      <!-- Layouts tab -->
      <div v-else-if="activeTab === 'layouts'" class="p-6 space-y-4">
        <p class="text-sm text-gray-500">Define the layout options available when this venue is booked. Each layout can have its own pricing per membership tier.</p>

        <div v-if="loadingLayouts" class="text-center py-10 text-gray-400 text-sm">Loading…</div>

        <template v-else>
          <div v-for="(layout, li) in layouts" :key="layout._key" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <!-- Layout header row -->
            <div class="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <i class="pi pi-bars text-gray-300 text-xs cursor-grab" />
              <InputText v-model="layout.name" placeholder="Layout name" class="flex-1 text-sm font-medium" size="small" />
              <Select v-model="layout.granularity" :options="granularityOptions" option-label="label" option-value="value"
                class="w-36 text-sm" size="small" @change="onGranularityChange(layout)" />
              <button type="button" class="text-gray-300 hover:text-red-500 transition-colors" @click="removeLayout(li)">
                <i class="pi pi-trash text-sm" />
              </button>
            </div>
            <!-- Modes -->
            <div class="border-t border-gray-100">
              <div class="px-5 py-2.5 flex items-center justify-between">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Modes</p>
                <button type="button"
                  class="flex items-center gap-1 text-xs text-[#1E2157] hover:underline"
                  @click="layout.modes.push({ name: '', description: '', min_players: null, max_players: null, price: 0, price_type: 'INCLUDED' })">
                  <i class="pi pi-plus text-[10px]" /> Add mode
                </button>
              </div>
              <div v-if="!layout.modes.length" class="px-5 pb-3 text-xs text-gray-400 italic">
                No modes — e.g. Playing, Practicing, Tournament
              </div>
              <div class="divide-y divide-gray-50">
                <div v-for="(mode, mi) in layout.modes" :key="mi" class="px-5 py-3 flex flex-col gap-3">
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
                  <div class="ml-7 grid grid-cols-2 gap-3">
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
                      <Select v-model="mode.price_type" :options="layoutModesPriceTypes" option-label="label" option-value="value"
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
                    <div class="col-span-2 flex flex-col gap-1">
                      <label class="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Description (optional)</label>
                      <InputText v-model="mode.description" placeholder="Short description of this mode…"
                        class="w-full text-sm" size="small" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!layouts.length" class="bg-white rounded-xl border border-gray-200 px-5 py-8 text-center text-sm text-gray-400">
            <i class="pi pi-th-large text-2xl block mb-2 text-gray-300" />
            No layouts yet — add one below
          </div>

          <button type="button" class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1E2157] transition-colors"
            @click="addLayout">
            <i class="pi pi-plus text-xs" />
            Add layout
          </button>

          <div class="flex justify-end pt-2">
            <Button label="Save layouts" icon="pi pi-check" size="small" :loading="savingLayouts"
              @click="saveLayouts" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </template>
      </div>

      <!-- Rules tab -->
      <div v-else-if="activeTab === 'rules'" class="p-6 space-y-5">
        <div class="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">

          <div class="flex items-center px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-40 shrink-0">Max concurrent bookings</span>
            <InputNumber v-model="form.max_concurrent" :min="1" class="w-24" />
          </div>

          <div class="flex items-start px-5 py-4 gap-6">
            <span class="text-sm font-semibold text-gray-700 w-40 shrink-0 pt-1">Rules / notes</span>
            <Textarea v-model="form.rules" placeholder="Booking rules, setup notes…" auto-resize rows="4" class="flex-1 text-sm" />
          </div>

        </div>
      </div>


    </div>

    <!-- Footer (hidden in standalone mode — parent controls save) -->
    <div v-if="!standalone" class="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between bg-white">
      <button v-if="bookable?.id" type="button"
        class="text-sm text-red-400 hover:text-red-600 transition-colors"
        @click="$emit('delete')">
        Delete venue
      </button>
      <div v-else />
      <div class="flex gap-2">
        <Button label="Cancel" size="small" severity="secondary" text @click="$emit('cancel')" />
        <Button :label="bookable?.id ? 'Save changes' : 'Create venue'" icon="pi pi-check" size="small" :loading="saving"
          @click="save" style="background:#1E2157;border-color:#1E2157" />
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
const props = defineProps<{
  bookable?: any
  parentId?: string | null
  standalone?: boolean
  initialTab?: string
  allBookables?: any[]
}>()

const emit = defineEmits<{
  saved: [bookable: any]
  cancel: []
  delete: []
  'set-role': [role: 'standalone' | 'master' | 'linked']
}>()

const db = useDb()

const tabs = [
  { key: 'details', label: 'Details', icon: 'pi-info-circle' },
  { key: 'layouts', label: 'Layouts', icon: 'pi-th-large' },
  { key: 'rules',   label: 'Rules',   icon: 'pi-file-edit' },
]

const statusOptions = [
  { label: 'Active',   value: 'ACTIVE' },
  { label: 'Draft',    value: 'DRAFT' },
  { label: 'Archived', value: 'ARCHIVED' },
]

const masterOptions = computed(() =>
  (props.allBookables ?? []).filter(b => b.id !== props.bookable?.id && b.status !== 'ARCHIVED' && b.status !== 'DELETED')
)

const bookingViewOptions = [
  { label: 'Month', value: 'dayGridMonth' },
  { label: 'Week',  value: 'timeGridWeek' },
  { label: 'Day',   value: 'timeGridDay' },
  { label: 'List',  value: 'listWeek' },
]

const activeTab = ref(props.initialTab ?? 'details')
const saving = ref(false)
const newSport = ref('')
const newFeature = ref('')

type LayoutMode = { name: string; description: string; min_players: number | null; max_players: number | null; price: number; price_type: string }
const layouts = ref<Array<{
  _key: string; id?: string; name: string
  granularity: string; capacity_fraction: number
  modes: LayoutMode[]
}>>([])

const loadingLayouts = ref(false)
const savingLayouts = ref(false)

const granularityOptions = [
  { label: 'Full (1/1)',    value: 'FULL',    fraction: 1.0 },
  { label: 'Half (1/2)',    value: 'HALF',    fraction: 0.5 },
  { label: 'Third (1/3)',   value: 'THIRD',   fraction: 0.3333 },
  { label: 'Quarter (1/4)', value: 'QUARTER', fraction: 0.25 },
  { label: 'Custom',        value: 'CUSTOM',  fraction: null },
]

function onGranularityChange(layout: typeof layouts.value[0]) {
  const opt = granularityOptions.find(o => o.value === layout.granularity)
  if (opt?.fraction !== null && opt?.fraction !== undefined) {
    layout.capacity_fraction = opt.fraction
  }
}

const layoutModesPriceTypes = [
  { label: 'Included in layout', value: 'INCLUDED' },
  { label: 'Fixed price',        value: 'FIXED' },
  { label: 'Per hour',           value: 'PER_HOUR' },
  { label: 'Per person',         value: 'PER_PERSON' },
  { label: 'Free',               value: 'FREE' },
]

function addLayout() {
  layouts.value.push({ _key: crypto.randomUUID(), name: '', granularity: 'FULL', capacity_fraction: 1.0, modes: [] as LayoutMode[] })
}

function removeLayout(i: number) {
  layouts.value.splice(i, 1)
}

async function loadLayouts() {
  if (!props.bookable?.id) return
  loadingLayouts.value = true
  try {
    const layoutIdRows = (await (db.from as any)('bookable_layouts').select('id').eq('bookable_id', props.bookable.id)).data?.map((r: any) => r.id) ?? []
    const [{ data: layoutRows }, { data: modeRows }] = await Promise.all([
      (db.from as any)('bookable_layouts').select('*').eq('bookable_id', props.bookable.id).order('sort_order'),
      layoutIdRows.length ? (db.from as any)('bookable_layout_modes').select('*').in('layout_id', layoutIdRows).order('sort_order') : Promise.resolve({ data: [] }),
    ])
    layouts.value = (layoutRows ?? []).map((l: any) => {
      const modes: LayoutMode[] = (modeRows ?? []).filter((m: any) => m.layout_id === l.id).map((m: any) => ({
        name: m.name,
        description: m.description ?? '',
        min_players: m.min_players ?? null,
        max_players: m.max_players ?? null,
        price: Number(m.price ?? 0),
        price_type: m.price_type ?? 'INCLUDED',
      }))
      return { _key: l.id, id: l.id, name: l.name, granularity: l.granularity ?? 'FULL', capacity_fraction: Number(l.capacity_fraction ?? 1), modes }
    })
  } finally {
    loadingLayouts.value = false
  }
}

async function saveLayouts() {
  if (!props.bookable?.id) return
  savingLayouts.value = true
  try {
    // Replace all layouts for this bookable
    await (db.from as any)('bookable_layouts').delete().eq('bookable_id', props.bookable.id)
    if (!layouts.value.length) return
    const { data: inserted } = await (db.from as any)('bookable_layouts')
      .insert(layouts.value.filter(l => l.name.trim()).map((l, i) => ({
        bookable_id: props.bookable!.id,
        name: l.name.trim(),
        granularity: l.granularity ?? 'FULL',
        capacity_fraction: l.capacity_fraction ?? 1.0,
        sort_order: i,
      })))
      .select()
    if (!inserted) return
    const modeRows: any[] = []
    inserted.forEach((row: any, i: number) => {
      const src = layouts.value.filter(l => l.name.trim())[i]
      ;(src.modes ?? []).filter((m: LayoutMode) => m.name?.trim()).forEach((m: LayoutMode, mi: number) => {
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
    // Refresh so ids are accurate
    await loadLayouts()
  } finally {
    savingLayouts.value = false
  }
}

watch(activeTab, (tab) => {
  if (tab === 'layouts') loadLayouts()
})

const form = reactive({
  name: '',
  internal_name: '',
  description: '',
  location: '',
  sports: [] as string[],
  features: [] as string[],
  max_concurrent: 1,
  rules: '',
  status: 'ACTIVE',
  is_public: false,
  show_in_menu: false,
  show_location: true,
  default_booking_view: 'dayGridMonth',
  allow_multiple_layouts: true,
  master_id: null as string | null,
  isTempClosed: false,
  closed_from: null as Date | null,
  closed_until: null as Date | null,
  closure_reason: '',
  images: [] as string[],
  main_image: null as string | null,
  sponsor_image: null as string | null,
})

const uploadingPhoto = ref(false)

watch(() => props.bookable, (b) => {
  if (b && activeTab.value === 'layouts') loadLayouts()
  if (b) {
    form.name = b.name ?? ''
    form.internal_name = b.internal_name ?? ''
    form.description = b.description ?? ''
    form.location = b.location ?? ''
    form.sports = [...(b.sports ?? [])]
    form.features = [...(b.features ?? [])]
    form.max_concurrent = b.max_concurrent ?? 1
    form.rules = b.rules ?? ''
    form.status = b.status ?? 'ACTIVE'
    form.is_public = b.is_public ?? false
    form.show_in_menu = b.show_in_menu ?? false
    form.show_location = b.show_location ?? true
    form.default_booking_view = b.default_booking_view ?? 'dayGridMonth'
    form.allow_multiple_layouts = b.allow_multiple_layouts ?? true
    form.master_id = b.master_id ?? null
    form.closed_from = b.closed_from ? new Date(b.closed_from) : null
    form.closed_until = b.closed_until ? new Date(b.closed_until) : null
    form.closure_reason = b.closure_reason ?? ''
    form.isTempClosed = !!b.closed_from
    form.images = Array.isArray(b.images) ? [...b.images] : []
    form.main_image = b.main_image ?? null
    form.sponsor_image = b.sponsor_image ?? null
  } else {
    form.name = ''
    form.internal_name = ''
    form.description = ''
    form.location = ''
    form.sports = []
    form.features = []
    form.max_concurrent = 1
    form.rules = ''
    form.status = 'ACTIVE'
    form.is_public = false
    form.show_in_menu = false
    form.show_location = true
    form.default_booking_view = 'dayGridMonth'
    form.allow_multiple_layouts = true
    form.master_id = null
    form.isTempClosed = false
    form.closed_from = null
    form.closed_until = null
    form.closure_reason = ''
    form.images = []
    form.main_image = null
    form.sponsor_image = null
    activeTab.value = 'details'
  }
}, { immediate: true })

watch(() => props.initialTab, tab => {
  if (tab) activeTab.value = tab
})

const { reload: reloadMenuBookables } = useMenuBookables()

async function onShowInMenuToggle() {
  await save()
  reloadMenuBookables()
}

function onTempClosedToggle(val: boolean) {
  if (!val) { form.closed_from = null; form.closed_until = null; form.closure_reason = ''; save() }
}

function addSport() {
  const v = newSport.value.trim().replace(/,$/, '')
  if (v && !form.sports.includes(v)) form.sports.push(v)
  newSport.value = ''
}

function addFeature() {
  const v = newFeature.value.trim().replace(/,$/, '')
  if (v && !form.features.includes(v)) form.features.push(v)
  newFeature.value = ''
}

async function save() {
  if (!form.name.trim()) return
  saving.value = true
  const payload = {
    org_id: orgId.value,
    name: form.name.trim(),
    internal_name: form.internal_name.trim() || null,
    description: form.description.trim() || null,
    location: form.location.trim() || null,
    sports: form.sports,
    features: form.features,
    max_concurrent: form.max_concurrent ?? 1,
    rules: form.rules.trim() || null,
    status: form.status,
    is_public: form.is_public,
    show_in_menu: form.show_in_menu,
    show_location: form.show_location,
    default_booking_view: form.default_booking_view,
    allow_multiple_layouts: form.allow_multiple_layouts,
    master_id: form.master_id || null,
    closed_from: form.isTempClosed && form.closed_from ? form.closed_from.toISOString().slice(0, 10) : null,
    closed_until: form.isTempClosed && form.closed_until ? form.closed_until.toISOString().slice(0, 10) : null,
    closure_reason: form.isTempClosed ? form.closure_reason || null : null,
    images: form.images,
    main_image: form.main_image,
    sponsor_image: form.sponsor_image,
    type: 'VENUE',
    parent_id: props.parentId ?? props.bookable?.parent_id ?? null,
  }
  try {
    if (props.bookable?.id) {
      const { data, error } = await db.from('bookables').update(payload).eq('id', props.bookable.id).select().single()
      if (error) throw error
      emit('saved', data)
    } else {
      const { data, error } = await db.from('bookables').insert(payload).select().single()
      if (error) throw error
      emit('saved', data)
    }
  } finally {
    saving.value = false
  }
}

async function handlePhotoUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  uploadingPhoto.value = true
  try {
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await $fetch<{ url: string }>('/api/upload', { method: 'POST', body: fd })
      form.images.push(res.url)
    }
    await save()
  } finally {
    uploadingPhoto.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function removePhoto(index: number) {
  const url = form.images[index]
  form.images.splice(index, 1)
  if (form.main_image === url) form.main_image = null
  if (form.sponsor_image === url) form.sponsor_image = null
  await save()
}

async function setImageRole(url: string, role: 'main' | 'sponsor') {
  if (role === 'main') {
    form.main_image = form.main_image === url ? null : url
  } else {
    form.sponsor_image = form.sponsor_image === url ? null : url
  }
  await save()
}

defineExpose({ save, saving })
</script>
