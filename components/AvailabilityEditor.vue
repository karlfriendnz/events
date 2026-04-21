<template>
  <div class="p-6 space-y-6">

    <div v-if="loading" class="flex justify-center py-16">
      <i class="pi pi-spin pi-spinner text-2xl text-gray-300" />
    </div>

    <template v-else>

      <!-- ── Inline edit panel ──────────────────────────────────────── -->
      <div v-if="panelOpen" class="bg-white rounded-xl border border-gray-200 overflow-hidden">

        <!-- Panel header -->
        <div class="border-b border-gray-100 bg-gray-50 grid grid-cols-12 divide-x divide-gray-100">
          <div class="col-span-4 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 class="text-base font-semibold text-gray-800">{{ editing ? 'Edit rule' : 'Add rule' }}</h3>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ editing ? `Editing "${editing.name}"` : 'Define a new availability rule for this venue.' }}
              </p>
            </div>
          </div>
          <div class="col-span-8 px-6 py-4 flex items-center justify-between">
            <div v-if="form.rule_type !== 'CLOSED' && form.rule_type !== 'BLOCK'">
              <h3 class="text-base font-semibold text-gray-800">
                {{ form.rule_type === 'RESTRICTED' ? 'Access &amp; Pricing' : 'Pricing' }}
              </h3>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ form.rule_type === 'RESTRICTED'
                  ? 'Each row defines a group and their price. Only listed groups can book.'
                  : 'Set prices for different groups. Leave empty for no pricing rules.' }}
              </p>
            </div>
            <div v-else />
          </div>
        </div>

        <!-- Panel body: two columns -->
        <div class="grid grid-cols-12 divide-x divide-gray-100" style="min-height:360px">

          <!-- Left: basic settings -->
          <div class="col-span-4 p-6 space-y-5">

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-700">Name</label>
              <InputText v-model="form.name" placeholder="e.g. Junior peak hours" autofocus />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-700">Type</label>
              <div class="grid grid-cols-2 gap-2">
                <button v-for="t in RULE_TYPES" :key="t.value"
                  class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors"
                  :class="form.rule_type === t.value ? 'text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                  :style="form.rule_type === t.value ? { background: t.color, borderColor: t.color } : {}"
                  @click="form.rule_type = t.value">
                  <i :class="`pi ${t.icon} text-xs`" />
                  {{ t.label }}
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-700">Days</label>
              <div class="flex gap-1.5">
                <button v-for="(day, di) in DAYS" :key="day"
                  class="flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors"
                  :class="form.days_of_week.includes(di) ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
                  @click="toggleDay(di)">
                  {{ day }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">From</label>
                <input v-model="form.time_from" type="time"
                  class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">To</label>
                <input v-model="form.time_to" type="time" :min="form.time_from || undefined"
                  class="w-full h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E2157]/30 focus:border-[#1E2157]" />
              </div>
            </div>
            <p class="text-xs text-gray-400 -mt-2">Leave blank to apply all day.</p>

            <!-- Block-specific -->
            <template v-if="form.rule_type === 'BLOCK'">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Capacity used</label>
                <div class="flex items-center gap-2">
                  <InputNumber v-model="form.capacity_used" :min="1" :max="99" class="w-28" />
                  <span class="text-xs text-gray-400">slots</span>
                </div>
                <p class="text-xs text-gray-400">How many concurrent slots this consumes (e.g. 3 courts for club night).</p>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700">Colour</label>
                <div class="flex gap-2 flex-wrap">
                  <button v-for="c in BLOCK_COLORS" :key="c"
                    class="w-8 h-8 rounded-full border-2 transition-all"
                    :class="form.color === c ? 'border-gray-700 scale-110' : 'border-transparent hover:border-gray-300'"
                    :style="{ background: c }"
                    @click="form.color = c" />
                </div>
              </div>
            </template>
          </div>

          <!-- Right: access & pricing -->
          <div class="col-span-8 p-6 flex flex-col">

            <template v-if="form.rule_type === 'CLOSED'">
              <div class="flex flex-col items-center justify-center flex-1 text-center">
                <i class="pi pi-times-circle text-3xl text-red-200 mb-3" />
                <p class="text-sm text-gray-400">Closed rules block all bookings.</p>
                <p class="text-xs text-gray-300 mt-1">No pricing or access controls apply.</p>
              </div>
            </template>

            <template v-else-if="form.rule_type === 'BLOCK'">
              <div class="flex flex-col items-center justify-center flex-1 text-center">
                <i class="pi pi-lock text-3xl text-gray-200 mb-3" />
                <p class="text-sm text-gray-400">Block rules reserve capacity slots.</p>
                <p class="text-xs text-gray-300 mt-1">Configure details on the left.</p>
              </div>
            </template>

            <template v-else>
              <!-- Tier cards with line items -->
              <div v-if="form.price_tiers.length" class="space-y-3 mb-4">
                <div v-for="(tier, ti) in form.price_tiers" :key="ti"
                  class="border border-gray-200 rounded-xl overflow-hidden">
                  <!-- Tier header -->
                  <div class="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
                    <!-- Group pills + add -->
                    <div class="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                      <span v-for="(target, tIdx) in (tier.targets ?? [])" :key="tIdx"
                        class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                        :style="{ borderColor: singleTargetDotColor(target) + '80', background: singleTargetDotColor(target) + '20', color: singleTargetDotColor(target) }">
                        {{ singleTargetLabel(target) }}
                        <button type="button" class="hover:opacity-60 transition-opacity leading-none ml-0.5" @click="removeTarget(ti, tIdx)">
                          <i class="pi pi-times text-[8px]" />
                        </button>
                      </span>
                      <Select v-if="availableTierOptions.length"
                        :model-value="null"
                        :options="availableTierOptions"
                        option-label="label" option-value="value"
                        option-group-label="label" option-group-children="items"
                        size="small" placeholder="+ Add group"
                        @change="(e: any) => addTarget(ti, e.value)" />
                    </div>
                    <!-- Controls -->
                    <div class="flex items-center gap-1 shrink-0">
                      <Select v-model="tier.price_type" :options="PRICE_TYPES" option-label="label" option-value="value"
                        size="small" style="min-width:120px" />
                      <button type="button" title="Clone pricing tier"
                        class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-[#1E2157] hover:bg-gray-100 transition-colors"
                        @click="cloneTier(ti)">
                        <i class="pi pi-copy text-xs" />
                      </button>
                      <button type="button"
                        class="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        @click="removeTier(ti)">
                        <i class="pi pi-times text-xs" />
                      </button>
                    </div>
                  </div>
                  <!-- Free -->
                  <div v-if="tier.price_type === 'free'" class="px-4 py-3 text-xs text-green-600 font-medium">
                    Free — no charge
                  </div>
                  <!-- Two fee sections -->
                  <template v-else>
                    <!-- Per-time fees -->
                    <div class="px-3 pt-3 pb-2">
                      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {{ tier.price_type === 'per_hour' ? 'Per hour' : 'Per session' }} fees
                      </p>
                      <FeeLineItemsTable
                        :model-value="tier.time_fees ?? []"
                        :tokens="bookingTokens"
                        @update:model-value="v => { tier.time_fees = v }" />
                    </div>
                    <!-- Flat / one-off fees -->
                    <div class="px-3 pt-1 pb-3 border-t border-gray-100">
                      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-2">
                        One-off fees
                      </p>
                      <FeeLineItemsTable
                        :model-value="tier.flat_fees ?? []"
                        @update:model-value="v => { tier.flat_fees = v }" />
                    </div>
                  </template>
                </div>
              </div>

              <!-- Add row dropdown -->
              <Select v-model="addTierSelection" :options="availableTierOptions"
                option-label="label" option-value="value"
                option-group-label="label" option-group-children="items"
                placeholder="+ Add a group or membership type…" size="small" class="w-full"
                :disabled="!availableTierOptions.length"
                @change="onAddTierSelect" />
              <p v-if="!availableTierOptions.length" class="text-xs text-gray-400 mt-1.5">All available groups have been added.</p>
            </template>

          </div>
        </div>

        <!-- Panel footer -->
        <div class="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50">
          <Button label="Cancel" severity="secondary" text @click="closePanel" />
          <Button :label="editing ? 'Save changes' : 'Add rule'" :loading="saving"
            :disabled="!form.name || !form.days_of_week.length"
            style="background:#1E2157;border-color:#1E2157" @click="save" />
        </div>
      </div>

      <!-- ── Weekly visual ──────────────────────────────────────────── -->
      <div v-if="!panelOpen" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700">Weekly overview</h3>
          <div class="flex items-center gap-3 text-xs text-gray-400">
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-green-400 inline-block" /> Open</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Restricted</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Closed</span>
            <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-sm bg-gray-400 inline-block" /> Block</span>
          </div>
        </div>
        <div class="flex" style="height:320px">
          <div class="shrink-0 flex flex-col justify-between py-1 px-2 text-right border-r border-gray-100" style="width:44px">
            <span v-for="label in TIME_LABELS" :key="label" class="text-[10px] text-gray-300 leading-none">{{ label }}</span>
          </div>
          <div class="flex flex-1">
            <div v-for="(day, di) in DAYS" :key="day" class="flex-1 relative border-r border-gray-100 last:border-r-0">
              <div class="absolute top-0 left-0 right-0 text-center text-[10px] font-semibold text-gray-400 py-1 z-10 bg-white border-b border-gray-100">
                {{ day }}
              </div>
              <div v-for="rule in rulesForDay(di)" :key="rule.id"
                class="absolute left-0.5 right-0.5 rounded-sm opacity-80"
                :style="{ background: ruleColor(rule), top: `calc(${ruleTop(rule.time_from)}% + 20px)`, height: ruleHeight(rule.time_from, rule.time_to) }"
                :title="`${rule.name}: ${formatTime(rule.time_from)} – ${formatTime(rule.time_to)}`" />
            </div>
          </div>
        </div>
      </div>

      <!-- ── Rules list ─────────────────────────────────────────────── -->
      <div v-if="!panelOpen" class="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div class="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-gray-700">Availability rules</h3>
            <p class="text-xs text-gray-400 mt-0.5">Define when the venue is open, restricted, blocked, or closed.</p>
          </div>
          <Button v-if="!props.readonly" label="Add rule" icon="pi pi-plus" size="small"
            style="background:#1E2157;border-color:#1E2157" @click="openPanel()" />
        </div>

        <!-- Filter bar -->
        <div v-if="rules.length" class="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <IconField class="flex-1">
            <InputIcon class="pi pi-search" />
            <InputText v-model="filterText" placeholder="Search rules…" size="small" class="w-full" />
          </IconField>
          <div class="flex gap-1.5">
            <button
              class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
              :class="filterType === '' ? 'bg-[#1E2157] border-[#1E2157] text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
              @click="filterType = ''">All</button>
            <button v-for="t in RULE_TYPES" :key="t.value"
              class="px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors"
              :class="filterType === t.value ? 'text-white' : 'border-gray-200 text-gray-500 hover:bg-gray-50'"
              :style="filterType === t.value ? { background: t.color, borderColor: t.color } : {}"
              @click="filterType = filterType === t.value ? '' : t.value">
              {{ t.label }}
            </button>
          </div>
        </div>

        <div v-if="!rules.length" class="text-center py-12 text-gray-400">
          <i class="pi pi-calendar-times text-2xl block mb-2 text-gray-300" />
          <p class="text-sm">No rules yet. Without rules, the venue is open to anyone at all times.</p>
        </div>

        <div v-else-if="!filteredRules.length" class="text-center py-10 text-gray-400">
          <i class="pi pi-filter text-2xl block mb-2 text-gray-300" />
          <p class="text-sm">No rules match your filter.</p>
        </div>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <th class="px-5 py-2.5 text-left">Type</th>
              <th class="px-5 py-2.5 text-left">Name</th>
              <th class="px-5 py-2.5 text-left">Days</th>
              <th class="px-5 py-2.5 text-left">Time</th>
              <th class="px-5 py-2.5 text-left">Detail</th>
              <th class="px-5 py-2.5 text-left">Pricing</th>
              <th class="px-5 py-2.5 text-center">Active</th>
              <th v-if="!props.readonly" class="px-5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="rule in filteredRules" :key="rule.id" class="hover:bg-gray-50 transition-colors">
              <td class="px-5 py-3">
                <span class="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium" :class="ruleTypeBadge(rule.rule_type)">
                  <span class="w-1.5 h-1.5 rounded-full" :style="{ background: ruleColor(rule) }" />
                  {{ ruleTypeLabel(rule.rule_type) }}
                </span>
              </td>
              <td class="px-5 py-3">
                <span class="font-medium text-gray-800">{{ rule.name }}</span>
                <span v-if="props.readonly" class="ml-2 text-xs text-violet-500 italic">inherited</span>
              </td>
              <td class="px-5 py-3 text-gray-600">{{ formatDays(rule.days_of_week) }}</td>
              <td class="px-5 py-3 text-gray-600 whitespace-nowrap">
                <template v-if="rule.time_from">{{ formatTime(rule.time_from) }} – {{ formatTime(rule.time_to) }}</template>
                <span v-else class="text-gray-400">All day</span>
              </td>
              <td class="px-5 py-3 text-gray-500">
                <template v-if="rule.rule_type === 'BLOCK' && rule.capacity_used > 1">Uses {{ rule.capacity_used }} slots</template>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-5 py-3">
                <div v-if="rule.price_tiers?.length" class="flex flex-col gap-1">
                  <span v-for="(tier, ti) in rule.price_tiers" :key="ti" class="flex items-center gap-1.5 text-xs text-gray-600">
                    <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: tierDotColor(tier) }" />
                    <span class="font-medium text-gray-700">{{ tierWhoLabel(tier) }}</span>
                    <span class="text-gray-300">·</span>
                    <template v-if="tier.price_type === 'free'">
                      <span class="text-green-600 font-medium">Free</span>
                    </template>
                    <template v-else>
                      <span class="font-medium">${{ tierTimeTotal(tier).toFixed(2) }}</span>
                      <span class="text-gray-400">/ {{ tier.price_type === 'per_hour' ? 'hr' : 'session' }}</span>
                      <template v-if="tierFlatTotal(tier) > 0">
                        <span class="text-gray-300 mx-0.5">+</span>
                        <span class="font-medium">${{ tierFlatTotal(tier).toFixed(2) }}</span>
                        <span class="text-gray-400">flat</span>
                      </template>
                    </template>
                  </span>
                </div>
                <span v-else class="text-gray-300">—</span>
              </td>
              <td class="px-5 py-3 text-center">
                <ToggleSwitch v-if="!props.readonly" :modelValue="rule.is_active" @update:modelValue="toggleRule(rule)" />
                <span v-else class="text-xs" :class="rule.is_active ? 'text-green-500' : 'text-gray-400'">{{ rule.is_active ? 'Yes' : 'No' }}</span>
              </td>
              <td v-if="!props.readonly" class="px-5 py-3 text-right whitespace-nowrap">
                <Button icon="pi pi-pencil" severity="secondary" text rounded size="small" @click="openPanel(rule)" />
                <Button icon="pi pi-trash" severity="danger" text rounded size="small" @click="deleteRule(rule)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
const { orgId } = useOrg()
import { useToast } from 'primevue/usetoast'

const props = defineProps<{ bookableId: string; readonly?: boolean }>()
const emit = defineEmits<{ saved: [] }>()

const db = useDb()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const rules = ref<any[]>([])
const memberGroups = ref<any[]>([])

const bookingTokens = [
  { label: 'Date', value: '{date}' },
  { label: 'Start time', value: '{start_time}' },
  { label: 'End time', value: '{end_time}' },
  { label: 'Duration', value: '{duration}' },
]
const filterText = ref('')
const filterType = ref('')

const filteredRules = computed(() => {
  let result = rules.value
  if (filterType.value) result = result.filter(r => r.rule_type === filterType.value)
  if (filterText.value.trim()) {
    const q = filterText.value.toLowerCase()
    result = result.filter(r =>
      r.name.toLowerCase().includes(q) ||
      formatDays(r.days_of_week).toLowerCase().includes(q)
    )
  }
  return result
})

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIME_LABELS = ['6am', '9am', '12pm', '3pm', '6pm', '9pm', '11pm']
const DAY_START_MINS = 6 * 60
const DAY_END_MINS = 23 * 60
const TOTAL_MINS = DAY_END_MINS - DAY_START_MINS

const RULE_TYPES = [
  { value: 'OPEN',       label: 'Open',       icon: 'pi-check-circle', color: '#22C55E' },
  { value: 'RESTRICTED', label: 'Restricted',  icon: 'pi-users',        color: '#3B82F6' },
  { value: 'CLOSED',     label: 'Closed',      icon: 'pi-times-circle', color: '#EF4444' },
  { value: 'BLOCK',      label: 'Block',       icon: 'pi-lock',         color: '#6B7280' },
]

const MEMBERSHIP_TYPES = [
  { label: 'Junior',         value: 'junior',         color: '#8B5CF6' },
  { label: 'Senior',         value: 'senior',         color: '#3B82F6' },
  { label: 'Social',         value: 'social',         color: '#10B981' },
  { label: 'Coaching staff', value: 'coaching_staff', color: '#F59E0B' },
  { label: 'Committee',      value: 'committee',      color: '#EC4899' },
]

const BLOCK_COLORS = ['#6B7280', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444', '#10B981', '#1E2157']

const PRICE_TYPES = [
  { label: 'Free',        value: 'free' },
  { label: 'Per hour',    value: 'per_hour' },
  { label: 'Per session', value: 'per_session' },
]

// ── Load ────────────────────────────────────────────────────────────────────

async function load() {
  loading.value = true
  const [{ data: r }, { data: g }] = await Promise.all([
    (db.from as any)('availability_rules').select('*').eq('bookable_id', props.bookableId).order('sort_order').order('created_at'),
    db.from('member_groups').select('id, name, color, parent_id').eq('org_id', orgId.value).order('sort_order').order('name'),
  ])
  rules.value = r ?? []
  memberGroups.value = g ?? []
  loading.value = false
}

watch(() => props.bookableId, load, { immediate: true })

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function ruleTop(timeFrom: string | null): string {
  if (!timeFrom) return '0'
  return `${(Math.max(timeToMins(timeFrom) - DAY_START_MINS, 0) / TOTAL_MINS) * 100}`
}

function ruleHeight(timeFrom: string | null, timeTo: string | null): string {
  if (!timeFrom || !timeTo) return '100%'
  const from = Math.max(timeToMins(timeFrom) - DAY_START_MINS, 0)
  const to = Math.min(timeToMins(timeTo) - DAY_START_MINS, TOTAL_MINS)
  return `${Math.max((to - from) / TOTAL_MINS * 100, 2)}%`
}

function ruleColor(rule: any): string {
  if (rule.rule_type === 'CLOSED') return '#EF4444'
  if (rule.rule_type === 'RESTRICTED') return '#3B82F6'
  if (rule.rule_type === 'BLOCK') return rule.color ?? '#6B7280'
  return '#22C55E'
}

function ruleTypeBadge(type: string): string {
  if (type === 'CLOSED') return 'bg-red-50 text-red-600'
  if (type === 'RESTRICTED') return 'bg-blue-50 text-blue-600'
  if (type === 'BLOCK') return 'bg-gray-100 text-gray-600'
  return 'bg-green-50 text-green-600'
}

function ruleTypeLabel(type: string): string {
  return RULE_TYPES.find(t => t.value === type)?.label ?? type
}

function rulesForDay(dayIndex: number): any[] {
  return rules.value.filter(r => r.is_active && r.days_of_week.includes(dayIndex))
}

function formatDays(days: number[]): string {
  if (!days?.length) return '—'
  if (days.length === 7) return 'Every day'
  const sorted = [...days].sort()
  const parts: string[] = []
  let start = sorted[0], prev = sorted[0]
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] !== prev + 1) {
      parts.push(prev - start >= 2 ? `${DAYS[start]}–${DAYS[prev]}` : sorted.slice(sorted.indexOf(start), sorted.indexOf(prev) + 1).map(d => DAYS[d]).join(', '))
      start = sorted[i]; prev = sorted[i]
    } else { prev = sorted[i] }
  }
  return parts.join(', ')
}

function formatTime(t: string | null): string {
  if (!t) return '—'
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 || 12
  return m ? `${hour}:${String(m).padStart(2, '0')}${ampm}` : `${hour}${ampm}`
}

// ── Tier display helpers ──────────────────────────────────────────────────────

function singleTargetLabel(target: any): string {
  if (target.eligibility === 'anyone') return 'Anyone'
  if (target.eligibility === 'members_only') return 'Members only'
  if (target.eligibility === 'membership_type') {
    return MEMBERSHIP_TYPES.find(m => m.value === target.membership_type)?.label ?? target.membership_type ?? '?'
  }
  if (target.eligibility === 'group') {
    return memberGroups.value.find(g => g.id === target.group_id)?.name ?? 'Group'
  }
  return '?'
}

function singleTargetDotColor(target: any): string {
  if (target.eligibility === 'group') return memberGroups.value.find(g => g.id === target.group_id)?.color ?? '#94a3b8'
  if (target.eligibility === 'membership_type') return MEMBERSHIP_TYPES.find(m => m.value === target.membership_type)?.color ?? '#94a3b8'
  if (target.eligibility === 'members_only') return '#3B82F6'
  return '#94a3b8'
}

function tierWhoLabel(tier: any): string {
  if (tier.targets?.length) return tier.targets.map((t: any) => singleTargetLabel(t)).join(', ')
  return singleTargetLabel(tier)
}

function tierDotColor(tier: any): string {
  if (tier.targets?.length) return singleTargetDotColor(tier.targets[0])
  return singleTargetDotColor(tier)
}

function tierTimeTotal(tier: any): number {
  const items: any[] = tier.time_fees ?? (tier.line_items ?? [])
  return items.reduce((s, li) => s + (li.amount ?? 0), 0)
}

function tierFlatTotal(tier: any): number {
  return (tier.flat_fees ?? []).reduce((s: number, li: any) => s + (li.amount ?? 0), 0)
}

// ── Panel ────────────────────────────────────────────────────────────────────

const panelOpen = ref(false)
const editing = ref<any>(null)
const addTierSelection = ref<string | null>(null)

const form = ref({
  name: '',
  rule_type: 'OPEN' as string,
  days_of_week: [] as number[],
  time_from: '',
  time_to: '',
  capacity_used: 1,
  color: '#6B7280',
  price_tiers: [] as any[],
})

function migrateLineItems(tier: any): any {
  let result = { ...tier }
  // Migrate time_fees/flat_fees
  if (!result.time_fees || !result.flat_fees) {
    const oldItems: any[] = result.line_items ?? []
    const timeFees = oldItems.length
      ? oldItems
      : (result.price != null && result.price_type !== 'free')
        ? [{ id: crypto.randomUUID(), name: '', xero_code: '', amount: result.price }]
        : []
    result = { ...result, time_fees: timeFees, flat_fees: result.flat_fees ?? [] }
  }
  // Migrate single eligibility field to targets array
  if (!result.targets) {
    const target: any = { eligibility: result.eligibility ?? 'anyone' }
    if (result.group_id) target.group_id = result.group_id
    if (result.membership_type) target.membership_type = result.membership_type
    result = { ...result, targets: [target] }
  }
  return result
}

function expandLegacyTiers(tiers: any[]): any[] {
  const expanded: any[] = []
  for (const tier of tiers) {
    if (tier.eligibility === 'groups' && Array.isArray(tier.group_ids)) {
      // Old multi-group tier → one tier with multiple targets
      expanded.push(migrateLineItems({
        ...tier,
        targets: tier.group_ids.map((gid: string) => ({ eligibility: 'group', group_id: gid })),
      }))
    } else if (tier.eligibility === 'membership_types' && Array.isArray(tier.membership_types)) {
      expanded.push(migrateLineItems({
        ...tier,
        targets: tier.membership_types.map((mt: string) => ({ eligibility: 'membership_type', membership_type: mt })),
      }))
    } else {
      expanded.push(migrateLineItems({ ...tier }))
    }
  }
  return expanded
}

function openPanel(rule?: any) {
  editing.value = rule ?? null
  form.value = rule ? {
    name: rule.name,
    rule_type: rule.rule_type,
    days_of_week: [...rule.days_of_week],
    time_from: rule.time_from ? rule.time_from.slice(0, 5) : '',
    time_to: rule.time_to ? rule.time_to.slice(0, 5) : '',
    capacity_used: rule.capacity_used ?? 1,
    color: rule.color ?? '#6B7280',
    price_tiers: expandLegacyTiers(rule.price_tiers ?? []),
  } : {
    name: '', rule_type: 'OPEN', days_of_week: [], time_from: '', time_to: '',
    capacity_used: 1, color: '#6B7280', price_tiers: [],
  }
  addTierSelection.value = null
  panelOpen.value = true
}

function closePanel() {
  panelOpen.value = false
  editing.value = null
}

// ── Add-tier dropdown ─────────────────────────────────────────────────────────

function targetOptionKey(target: any): string {
  if (target.eligibility === 'group') return `g:${target.group_id}`
  if (target.eligibility === 'membership_type') return `mt:${target.membership_type}`
  return target.eligibility
}

function targetFromKey(val: string): any {
  if (val === 'anyone') return { eligibility: 'anyone' }
  if (val === 'members_only') return { eligibility: 'members_only' }
  if (val.startsWith('mt:')) return { eligibility: 'membership_type', membership_type: val.slice(3) }
  if (val.startsWith('g:')) return { eligibility: 'group', group_id: val.slice(2) }
  return null
}

const allUsedTargetKeys = computed(() => {
  const keys = new Set<string>()
  for (const tier of form.value.price_tiers) {
    for (const t of tier.targets ?? []) {
      keys.add(targetOptionKey(t))
    }
  }
  return keys
})

const availableTierOptions = computed(() => {
  const used = allUsedTargetKeys.value
  const groups: { label: string; items: { label: string; value: string }[] }[] = []

  // General
  const general: { label: string; value: string }[] = []
  if (!used.has('anyone')) general.push({ label: 'Anyone', value: 'anyone' })
  if (!used.has('members_only')) general.push({ label: 'Members only', value: 'members_only' })
  if (general.length) groups.push({ label: 'General', items: general })

  // Membership types
  const mtItems = MEMBERSHIP_TYPES.filter(mt => !used.has(`mt:${mt.value}`))
    .map(mt => ({ label: mt.label, value: `mt:${mt.value}` }))
  if (mtItems.length) groups.push({ label: 'Membership Types', items: mtItems })

  // Member groups — top-level parents become section headers; children nest underneath
  const topLevel = memberGroups.value.filter(g => !g.parent_id && !used.has(`g:${g.id}`))
  const childrenOf = (id: string) => memberGroups.value.filter(g => g.parent_id === id && !used.has(`g:${g.id}`))

  for (const parent of topLevel) {
    const children = childrenOf(parent.id)
    const items: { label: string; value: string }[] = [
      { label: parent.name, value: `g:${parent.id}` },
      ...children.map(c => ({ label: `  ${c.name}`, value: `g:${c.id}` })),
    ]
    groups.push({ label: parent.name, items })
  }

  // Orphaned children whose parent is already used — show in a fallback group
  const orphans = memberGroups.value.filter(g => g.parent_id && !used.has(`g:${g.id}`) && used.has(`g:${g.parent_id}`))
  if (orphans.length) groups.push({ label: 'Sub-groups', items: orphans.map(g => ({ label: g.name, value: `g:${g.id}` })) })

  return groups
})

function onAddTierSelect() {
  const val = addTierSelection.value
  if (!val) return
  const target = targetFromKey(val)
  if (target) {
    form.value.price_tiers.push({ price_type: 'per_hour', price: null, time_fees: [], flat_fees: [], targets: [target] })
  }
  nextTick(() => { addTierSelection.value = null })
}

function addTarget(ti: number, val: string) {
  const target = targetFromKey(val)
  if (target) form.value.price_tiers[ti].targets = [...(form.value.price_tiers[ti].targets ?? []), target]
}

function removeTarget(ti: number, tIdx: number) {
  const targets = [...(form.value.price_tiers[ti].targets ?? [])]
  targets.splice(tIdx, 1)
  form.value.price_tiers[ti].targets = targets
}

function removeTier(i: number) {
  form.value.price_tiers.splice(i, 1)
}

function cloneTier(i: number) {
  const src = form.value.price_tiers[i]
  const clone = JSON.parse(JSON.stringify(src))
  clone.time_fees = (clone.time_fees ?? []).map((li: any) => ({ ...li, id: crypto.randomUUID() }))
  clone.flat_fees = (clone.flat_fees ?? []).map((li: any) => ({ ...li, id: crypto.randomUUID() }))
  form.value.price_tiers.splice(i + 1, 0, clone)
}

// ── Save / delete ─────────────────────────────────────────────────────────────

async function save() {
  saving.value = true
  const isBlock = form.value.rule_type === 'BLOCK'
  const payload: any = {
    bookable_id: props.bookableId,
    name: form.value.name,
    rule_type: form.value.rule_type,
    days_of_week: form.value.days_of_week,
    time_from: form.value.time_from || null,
    time_to: form.value.time_to || null,
    eligibility: 'anyone',
    membership_types: [],
    group_ids: [],
    capacity_used: isBlock ? form.value.capacity_used : 1,
    color: isBlock ? form.value.color : '#6B7280',
    price_tiers: isBlock ? [] : form.value.price_tiers.map(t => ({
      ...t,
      price: t.price_type === 'free' ? null : (t.time_fees ?? []).reduce((s: number, li: any) => s + (li.amount ?? 0), 0),
    })),
    sort_order: editing.value?.sort_order ?? rules.value.length,
  }
  if (editing.value) {
    await (db.from as any)('availability_rules').update(payload).eq('id', editing.value.id)
  } else {
    await (db.from as any)('availability_rules').insert(payload)
  }
  await load()
  closePanel()
  saving.value = false
  emit('saved')
}

async function toggleRule(rule: any) {
  await (db.from as any)('availability_rules').update({ is_active: !rule.is_active }).eq('id', rule.id)
  rule.is_active = !rule.is_active
}

async function deleteRule(rule: any) {
  if (!confirm(`Delete "${rule.name}"?`)) return
  await (db.from as any)('availability_rules').delete().eq('id', rule.id)
  rules.value = rules.value.filter(r => r.id !== rule.id)
  emit('saved')
}

function toggleDay(day: number) {
  const idx = form.value.days_of_week.indexOf(day)
  if (idx >= 0) form.value.days_of_week.splice(idx, 1)
  else form.value.days_of_week.push(day)
}
</script>
