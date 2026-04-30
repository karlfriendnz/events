<template>
  <div class="flex flex-col" style="height: calc(100vh - 3.5rem)">

    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      <i class="pi pi-spin pi-spinner text-xl" />
    </div>

    <template v-else>

      <!-- Hero header -->
      <div class="bg-white border-b border-gray-200 shrink-0">
        <div class="max-w-[1140px] mx-auto px-6 py-4 flex items-start gap-4">
          <NuxtLink :to="`/activities/${route.params.id}`"
            class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors shrink-0 mt-1">
            <i class="pi pi-arrow-left text-xs" />
            Back
          </NuxtLink>

          <!-- Colour swatch / image -->
          <div class="shrink-0">
            <div v-if="form.image_url" class="w-12 h-12 rounded-xl overflow-hidden border border-gray-200">
              <img :src="form.image_url" class="w-full h-full object-cover" />
            </div>
            <div v-else class="w-12 h-12 rounded-xl flex items-center justify-center"
              :style="{ background: (form.color || '#1E2157') + '20' }">
              <i class="pi pi-sliders-h text-base" :style="{ color: form.color || '#1E2157' }" />
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <p v-if="activityName" class="text-xs text-gray-400 mb-0.5">{{ activityName }}</p>
            <h1 class="text-lg font-bold text-gray-900 truncate">
              {{ isNew ? 'New mode' : (form.name || 'Untitled mode') }}
            </h1>
            <!-- Status chips -->
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                :class="form.approval_mode === 'INSTANT' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'">
                <i class="pi text-[8px]" :class="form.approval_mode === 'INSTANT' ? 'pi-bolt' : 'pi-clock'" />
                {{ form.approval_mode === 'INSTANT' ? 'Auto-confirm' : 'Approval needed' }}
              </span>
              <span v-if="form.min_people || form.max_people"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <i class="pi pi-users text-[8px]" />
                {{ form.min_people && form.max_people ? `${form.min_people}–${form.max_people}`
                   : form.min_people ? `${form.min_people}+`
                   : `Up to ${form.max_people}` }}
              </span>
              <span v-if="form.allow_visitors"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                <i class="pi pi-user-plus text-[8px]" />
                Visitors
              </span>
              <span v-if="form.form_id"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                <i class="pi pi-list text-[8px]" />
                {{ selectedFormFieldCount ? `${selectedFormFieldCount} question${selectedFormFieldCount === 1 ? '' : 's'}` : 'Custom form' }}
              </span>
              <span v-if="form.form_id && selectedFormRuleCount > 0"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700"
                v-tooltip.bottom="'Visibility or financial rules configured on this form'">
                <i class="pi pi-bolt text-[8px]" />
                {{ selectedFormRuleCount }} rule{{ selectedFormRuleCount === 1 ? '' : 's' }}
              </span>
              <span v-if="(form.addons ?? []).length"
                class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
                <i class="pi pi-plus-circle text-[8px]" />
                {{ form.addons.length }} add-on{{ form.addons.length === 1 ? '' : 's' }}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button v-if="!isNew" type="button"
              class="text-sm text-red-400 hover:text-red-600 transition-colors px-2"
              @click="deleteMode">Delete</button>
            <Button :label="isNew ? 'Create mode' : 'Save changes'"
              icon="pi pi-check"
              :disabled="!form.name.trim()" :loading="saving"
              @click="save" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>
      </div>

      <!-- Tabbed body -->
      <div class="flex-1 overflow-y-auto bg-[#F5F8FA]">
        <div class="max-w-[1140px] mx-auto px-6 pt-2 pb-10">
          <Tabs value="details">
            <TabList>
              <Tab value="details"><i class="pi pi-pencil text-xs mr-2" />Details</Tab>
              <Tab value="pricing"><i class="pi pi-dollar text-xs mr-2" />Pricing</Tab>
              <Tab value="bookings"><i class="pi pi-calendar text-xs mr-2" />Bookings</Tab>
            </TabList>
            <TabPanels>

              <!-- ── DETAILS ── -->
              <TabPanel value="details" class="space-y-6">
                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Details</h2>
                  <p class="text-xs text-gray-500 mb-3">How this mode shows up to bookers and staff.</p>
                  <AppCard>
                    <div class="p-5 grid grid-cols-2 gap-5">
                      <div class="flex flex-col gap-1.5 col-span-2">
                        <label class="text-sm font-medium text-gray-700">Name <span class="text-red-400">*</span></label>
                        <InputText v-model="form.name" placeholder="e.g. Boys Birthday" class="w-full" />
                      </div>
                      <div class="flex flex-col gap-1.5 col-span-2">
                        <label class="text-sm font-medium text-gray-700">Description <span class="text-gray-400 font-normal">(optional)</span></label>
                        <InputText v-model="form.description" placeholder="Short description shown to bookers" class="w-full" />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium text-gray-700">Colour</label>
                        <div class="flex gap-2.5 flex-wrap pt-1">
                          <button v-for="c in COLORS" :key="c" type="button"
                            class="w-6 h-6 rounded-full ring-offset-2 transition-all"
                            :style="{ background: c }"
                            :class="form.color === c ? 'ring-2 ring-gray-700' : 'hover:ring-2 hover:ring-gray-300'"
                            @click="form.color = c" />
                        </div>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="text-sm font-medium text-gray-700">Image <span class="text-gray-400 font-normal">(optional)</span></label>
                        <label class="cursor-pointer w-fit">
                          <div v-if="form.image_url" class="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200">
                            <img :src="form.image_url" class="w-full h-full object-cover" />
                            <button type="button"
                              class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                              @click.prevent="form.image_url = ''">
                              <i class="pi pi-times text-white" />
                            </button>
                          </div>
                          <div v-else class="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-gray-400 transition-colors">
                            <i v-if="!uploadingImage" class="pi pi-image text-gray-400 text-xl" />
                            <i v-else class="pi pi-spin pi-spinner text-gray-400" />
                            <span v-if="!uploadingImage" class="text-xs text-gray-400">Upload</span>
                          </div>
                          <input type="file" accept="image/*" class="hidden" @change="handleImageUpload" />
                        </label>
                      </div>
                    </div>
                  </AppCard>
                </div>

                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Capacity</h2>
                  <p class="text-xs text-gray-500 mb-3">How many people can book this mode at a time.</p>
                  <AppCard>
                    <div class="divide-y divide-gray-100">
                      <SettingsRow label="Min people">
                        <ToggleSwitch :modelValue="form.min_people !== null"
                          @update:modelValue="v => form.min_people = v ? 1 : null" />
                        <InputNumber v-if="form.min_people !== null" v-model="form.min_people" :min="1" :max="9999" class="w-24" />
                        <span v-else class="text-sm text-gray-400">No minimum</span>
                      </SettingsRow>
                      <SettingsRow label="Max people">
                        <ToggleSwitch :modelValue="form.max_people !== null"
                          @update:modelValue="v => form.max_people = v ? 10 : null" />
                        <InputNumber v-if="form.max_people !== null" v-model="form.max_people" :min="1" :max="9999" class="w-24" />
                        <span v-else class="text-sm text-gray-400">No maximum</span>
                      </SettingsRow>
                      <SettingsRow label="Allow visitors">
                        <ToggleSwitch v-model="form.allow_visitors"
                          @update:modelValue="v => { form.min_visitors = v ? form.min_visitors : null; form.max_visitors = v ? form.max_visitors : null }" />
                        <span v-if="!form.allow_visitors" class="text-sm text-gray-400">Visitors not permitted</span>
                      </SettingsRow>
                      <template v-if="form.allow_visitors">
                        <SettingsRow label="Min visitors" class="bg-gray-50/60 pl-4">
                          <ToggleSwitch :modelValue="form.min_visitors !== null"
                            @update:modelValue="v => form.min_visitors = v ? 1 : null" />
                          <InputNumber v-if="form.min_visitors !== null" v-model="form.min_visitors" :min="1" :max="9999" class="w-24" />
                          <span v-else class="text-sm text-gray-400">No minimum</span>
                        </SettingsRow>
                        <SettingsRow label="Max visitors" class="bg-gray-50/60 pl-4">
                          <ToggleSwitch :modelValue="form.max_visitors !== null"
                            @update:modelValue="v => form.max_visitors = v ? 10 : null" />
                          <InputNumber v-if="form.max_visitors !== null" v-model="form.max_visitors" :min="1" :max="9999" class="w-24" />
                          <span v-else class="text-sm text-gray-400">No maximum</span>
                        </SettingsRow>
                      </template>
                    </div>
                  </AppCard>
                </div>
              </TabPanel>

              <!-- ── PRICING ── -->
              <TabPanel value="pricing" class="space-y-6">
                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Pricing</h2>
                  <p class="text-xs text-gray-500 mb-3">Default rates and per-tier overrides for this mode.</p>
                  <AppCard>
                    <div class="p-5">
                      <ModePricingTiersEditor
                        v-model="form.pricing"
                        :addons="form.addons"
                        :groups="allGroups" />
                    </div>
                  </AppCard>
                </div>

                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Add-ons</h2>
                  <p class="text-xs text-gray-500 mb-3">Optional extras with flat or tiered pricing — equipment, catering, etc.</p>
                  <AppCard>
                    <div class="p-5">
                      <ModeAddonsEditor v-model="form.addons" />
                    </div>
                  </AppCard>
                </div>

                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Payment Options</h2>
                  <p class="text-xs text-gray-500 mb-3">
                    <template v-if="!hasOwnPaymentOptions">
                      Inheriting site defaults from <NuxtLink to="/settings" class="text-[#1E2157] underline">Settings</NuxtLink>.
                      Toggle any method below to override.
                    </template>
                    <template v-else>
                      Custom for this mode. <button type="button" class="text-[#1E2157] underline" @click="resetToOrgDefaults">Use site defaults</button>
                    </template>
                  </p>
                  <AppCard>
                    <div class="p-5">
                      <PaymentOptionsEditor
                        :modelValue="effectivePayment"
                        @update:modelValue="onPaymentOptionsUpdate" />
                    </div>
                  </AppCard>
                </div>
              </TabPanel>

              <!-- ── BOOKINGS ── -->
              <TabPanel value="bookings" class="space-y-6">
                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Approval</h2>
                  <p class="text-xs text-gray-500 mb-3">When someone books this mode, should it be confirmed straight away or wait for staff approval?</p>
                  <AppCard>
                    <div class="p-5 space-y-2">
                      <label class="flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors"
                        :class="form.approval_mode === 'INSTANT' ? 'border-[#1E2157] bg-[#EFF6FF]/40' : 'border-gray-200 hover:bg-gray-50'">
                        <input type="radio" value="INSTANT" v-model="form.approval_mode" class="mt-1 w-4 h-4 accent-[#1E2157]" />
                        <div class="flex-1">
                          <p class="text-sm font-semibold text-gray-800">Instantly confirmed</p>
                          <p class="text-xs text-gray-500 mt-0.5">Bookings go live immediately and the slot is reserved.</p>
                        </div>
                      </label>
                      <label class="flex items-start gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-colors"
                        :class="form.approval_mode === 'REQUIRES_APPROVAL' ? 'border-[#1E2157] bg-[#EFF6FF]/40' : 'border-gray-200 hover:bg-gray-50'">
                        <input type="radio" value="REQUIRES_APPROVAL" v-model="form.approval_mode" class="mt-1 w-4 h-4 accent-[#1E2157]" />
                        <div class="flex-1">
                          <p class="text-sm font-semibold text-gray-800">Requires approval</p>
                          <p class="text-xs text-gray-500 mt-0.5">Bookings come in as Pending — staff confirm or decline before the slot is held.</p>
                        </div>
                      </label>
                    </div>
                  </AppCard>
                </div>

                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Booking form</h2>
                  <p class="text-xs text-gray-500 mb-3">Custom questions asked during the Details step. Forms can be shared across modes and events.</p>
                  <AppCard>
                    <div class="p-5">
                      <div class="flex items-center gap-2">
                        <Select v-model="form.form_id" :options="formOptions" option-label="label" option-value="value"
                          placeholder="Use built-in core fields" filter show-clear class="flex-1" />
                        <Button v-if="form.form_id" label="Edit" icon="pi pi-pencil" size="small" severity="secondary" outlined
                          @click="navigateTo(`/forms/${form.form_id}?return=${encodeURIComponent($route.fullPath)}`)" />
                        <Button label="New form" icon="pi pi-plus" size="small"
                          style="background:#1E2157;border-color:#1E2157"
                          @click="navigateTo(`/forms/new?return=${encodeURIComponent($route.fullPath)}`)" />
                      </div>
                      <p v-if="form.form_id && selectedFormFieldCount" class="text-xs text-gray-400 mt-2">
                        {{ selectedFormFieldCount }} {{ selectedFormFieldCount === 1 ? 'question' : 'questions' }} on this form
                      </p>
                    </div>
                  </AppCard>
                </div>

                <div>
                  <h2 class="text-sm font-bold text-gray-800 mb-1">Booking wizard calendar</h2>
                  <p class="text-xs text-gray-500 mb-3">Calendar view shown at the date &amp; time step when this mode is selected.</p>
                  <AppCard>
                    <SettingsRow label="Default view" description="Falls back to the venue's default if not set.">
                      <Select v-model="form.default_booking_view" :options="bookingViewOptions"
                        option-label="label" option-value="value" placeholder="Use venue default" show-clear class="w-44" />
                    </SettingsRow>
                  </AppCard>
                </div>
              </TabPanel>

            </TabPanels>
          </Tabs>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const db = useDb()
const { orgId } = useOrg()

const COLORS = ['#6366F1','#EF4444','#F59E0B','#10B981','#3B82F6','#EC4899','#8B5CF6','#F97316','#14B8A6','#84CC16']

const isNew = computed(() => route.params.modeId === 'new')

const loading = ref(true)
const saving = ref(false)
const uploadingImage = ref(false)
const activityName = ref('')
const allGroups = ref<any[]>([])

function emptyPricing() {
  return { base: [], per_person: [], per_hour: [], tiers: [] }
}

function normalizePricing(p: any) {
  if (!p) return emptyPricing()
  const extractFees = (val: any) => {
    if (!val) return []
    if (Array.isArray(val)) return val
    return val.fees ?? []
  }
  return {
    base: extractFees(p.base),
    per_person: extractFees(p.per_person),
    per_hour: extractFees(p.per_hour),
    tiers: p.tiers ?? [],
  }
}

function cleanFees(fees: any[]) {
  return (fees ?? []).filter((f: any) => f.name?.trim() || f.amount != null)
}

function cleanPricing(p: any) {
  const cleanOrNull = (fees: any) => fees === null ? null : cleanFees(fees)
  return {
    base: cleanFees(p?.base),
    per_person: cleanFees(p?.per_person),
    per_hour: cleanFees(p?.per_hour),
    tiers: (p?.tiers ?? []).map((tier: any) => ({
      ...tier,
      base: cleanOrNull(tier.base),
      per_person: cleanOrNull(tier.per_person),
      per_hour: cleanOrNull(tier.per_hour),
      addon_overrides: (tier.addon_overrides ?? []).map((o: any) => ({ ...o, fees: cleanFees(o.fees) })),
    })),
  }
}

function cleanAddons(addons: any[]) {
  return (addons ?? [])
    .filter((a: any) => a.name?.trim())
    .map((a: any) => ({ ...a, fees: cleanFees(a.fees) }))
}

const form = reactive({
  name: '',
  description: '',
  color: COLORS[0],
  image_url: '',
  pricing: emptyPricing() as any,
  addons: [] as any[],
  min_people:     null as number | null,
  max_people:     null as number | null,
  allow_visitors: false,
  min_visitors:   null as number | null,
  max_visitors:   null as number | null,
  form_id:        null as string | null,
  default_booking_view: null as string | null,
  payment_options: { invoice: false, credit_card: false, payment_plan: false, coupon: false } as Record<string, boolean>,
  approval_mode: 'INSTANT' as 'INSTANT' | 'REQUIRES_APPROVAL',
})

const bookingViewOptions = [
  { label: 'Month', value: 'dayGridMonth' },
  { label: 'Week',  value: 'timeGridWeek' },
  { label: 'Day',   value: 'timeGridDay' },
  { label: 'List',  value: 'listWeek' },
]

const paymentMethodOptions = [
  { value: 'card',    label: 'Credit / Debit Card', icon: 'pi-credit-card', description: 'Pay online at submission.' },
  { value: 'bank',    label: 'Bank Transfer',        icon: 'pi-building',    description: 'Receive bank details to pay later.' },
  { value: 'cash',    label: 'Cash on the Day',      icon: 'pi-dollar',      description: 'Hand over cash on arrival.' },
  { value: 'invoice', label: 'Invoice',              icon: 'pi-file',        description: 'Send an invoice to settle later.' },
]

const orgDefaultPaymentOptions = ref<Record<string, boolean>>({})
const hasOwnPaymentOptions = computed(() =>
  Object.values(form.payment_options).some(v => v),
)
const effectivePayment = computed(() =>
  hasOwnPaymentOptions.value ? form.payment_options : orgDefaultPaymentOptions.value,
)
function onPaymentOptionsUpdate(next: Record<string, boolean>) {
  // First time the user toggles anything on, copy the org defaults across so
  // the mode keeps everything currently inherited.
  const turningOn = Object.entries(next).some(([k, v]) => v && !form.payment_options[k])
  if (!hasOwnPaymentOptions.value && turningOn) {
    Object.assign(form.payment_options, orgDefaultPaymentOptions.value)
  }
  for (const k of Object.keys(form.payment_options)) form.payment_options[k] = !!next[k]
}
function resetToOrgDefaults() {
  for (const k of Object.keys(form.payment_options)) form.payment_options[k] = false
}

// Forms picker
const allForms = ref<any[]>([])
const formFieldCounts = ref<Record<string, number>>({})
const formRuleCounts  = ref<Record<string, number>>({})

const formOptions = computed(() =>
  allForms.value.map(f => ({
    value: f.id,
    label: formFieldCounts.value[f.id]
      ? `${f.name} (${formFieldCounts.value[f.id]} ${formFieldCounts.value[f.id] === 1 ? 'question' : 'questions'})`
      : f.name,
  })),
)

const selectedFormFieldCount = computed(() => form.form_id ? (formFieldCounts.value[form.form_id] ?? 0) : 0)
const selectedFormRuleCount  = computed(() => form.form_id ? (formRuleCounts.value[form.form_id] ?? 0) : 0)

async function loadForms() {
  if (!orgId.value) return
  // Pull `config` so we can count visibility/financial rules per form via fieldMeta.
  const { data: forms } = await (db.from as any)('registration_forms').select('id, name, config').eq('org_id', orgId.value).order('name')
  allForms.value = forms ?? []
  // Field counts (form_fields rows).
  if (forms?.length) {
    const { data: fields } = await (db.from as any)('form_fields').select('form_id').in('form_id', forms.map((f: any) => f.id))
    const counts: Record<string, number> = {}
    for (const f of fields ?? []) counts[f.form_id] = (counts[f.form_id] ?? 0) + 1
    formFieldCounts.value = counts
  }
  // Rule counts (sum of has_visibility + has_financial flags across the form's fieldMeta).
  const ruleCounts: Record<string, number> = {}
  for (const f of forms ?? []) {
    const meta = (f.config as any)?.fieldMeta ?? {}
    let n = 0
    for (const fm of Object.values(meta) as any[]) {
      if (fm?.has_visibility_conditions && (fm.visibility_conditions ?? []).length) n += 1
      if (fm?.has_financial_increase) n += (fm.financial_rules ?? []).length || 1
    }
    ruleCounts[f.id] = n
  }
  formRuleCounts.value = ruleCounts
}

useBreadcrumbs([
  { label: 'Activities', to: '/activities' },
])

async function load() {
  loading.value = true
  try {
    const [{ data: act }, { data: groups }, { data: orgRow }] = await Promise.all([
      (db.from as any)('activities').select('name').eq('id', route.params.id).single(),
      (db.from as any)('member_groups').select('id, name, color').eq('org_id', orgId.value).order('name'),
      (db.from as any)('organisations').select('default_payment_options').eq('id', orgId.value).single(),
    ])
    activityName.value = act?.name ?? ''
    allGroups.value = groups ?? []
    orgDefaultPaymentOptions.value = (orgRow?.default_payment_options as Record<string, boolean>) ?? {}

    if (!isNew.value) {
      const { data: mode } = await (db.from as any)('activity_modes')
        .select('*').eq('id', route.params.modeId).single()
      if (mode) {
        form.name = mode.name
        form.description = mode.description ?? ''
        form.color = mode.color ?? COLORS[0]
        form.image_url = mode.image_url ?? ''
        form.pricing = normalizePricing(mode.pricing)
        form.addons = mode.addons ?? []
        form.min_people     = mode.min_people     ?? null
        form.max_people     = mode.max_people     ?? null
        form.allow_visitors = mode.allow_visitors ?? false
        form.min_visitors   = mode.min_visitors   ?? null
        form.max_visitors   = mode.max_visitors   ?? null
        form.form_id        = mode.form_id        ?? null
        form.default_booking_view = mode.default_booking_view ?? null
        Object.assign(form.payment_options, mode.payment_options ?? {})
        form.approval_mode = mode.approval_mode ?? 'INSTANT'
      }
    }
    await loadForms()

    // Apply ?form_id from a return-trip from /forms/new or /forms/:id
    const fromQuery = route.query.form_id as string | undefined
    if (fromQuery) form.form_id = fromQuery
  } finally {
    loading.value = false
  }
}

async function handleImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingImage.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await $fetch<{ url: string }>('/api/upload', { method: 'POST', body: fd })
    form.image_url = res.url
  } finally {
    uploadingImage.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function save() {
  if (!form.name.trim()) return
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color,
      image_url: form.image_url || null,
      pricing: cleanPricing(form.pricing),
      addons: cleanAddons(form.addons),
      min_people:     form.min_people,
      max_people:     form.max_people,
      allow_visitors: form.allow_visitors,
      min_visitors:   form.allow_visitors ? form.min_visitors : null,
      max_visitors:   form.allow_visitors ? form.max_visitors : null,
      form_id:        form.form_id,
      default_booking_view: form.default_booking_view || null,
      payment_options: { ...form.payment_options },
      approval_mode: form.approval_mode,
    }

    if (isNew.value) {
      const { data } = await (db.from as any)('activity_modes').insert({
        ...payload,
        activity_id: route.params.id,
        sort_order: 0,
      }).select().single()
      if (data) navigateTo(`/activities/${route.params.id}`)
    } else {
      await (db.from as any)('activity_modes').update(payload).eq('id', route.params.modeId)
      navigateTo(`/activities/${route.params.id}`)
    }
  } finally {
    saving.value = false
  }
}

async function deleteMode() {
  if (!confirm('Delete this mode? This cannot be undone.')) return
  await (db.from as any)('activity_modes').delete().eq('id', route.params.modeId)
  navigateTo(`/activities/${route.params.id}`)
}

onMounted(load)
</script>
