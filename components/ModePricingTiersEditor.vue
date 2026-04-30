<template>
  <div class="space-y-8">

    <!-- Default pricing -->
    <div>
      <div class="mb-3">
        <h3 class="text-sm font-semibold text-gray-800">Default pricing</h3>
        <p class="text-xs text-gray-400 mt-0.5">Applies to all bookings unless a tier overrides it</p>
      </div>
      <div class="space-y-2">
        <div v-for="section in SECTIONS" :key="section.key"
          class="border border-gray-200 rounded-xl overflow-hidden">
          <button type="button"
            class="w-full px-4 py-3 flex items-center gap-3 bg-white hover:bg-gray-50 transition-colors text-left"
            @click="toggleDefault(section.key)">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-800">{{ section.label }}</p>
              <p class="text-xs text-gray-400 mt-0.5">{{ section.subtitle }}</p>
            </div>
            <span class="text-sm font-semibold shrink-0 tabular-nums"
              :class="defaultHasValue(section.key) ? 'text-gray-800' : 'text-gray-300'">
              {{ defaultHasValue(section.key) ? `$${feeTotal(getDefaultFees(section.key))}` : '—' }}
            </span>
            <i :class="`pi pi-chevron-${defaultOpen[section.key] ? 'up' : 'down'} text-gray-400 text-xs shrink-0`" />
          </button>
          <div v-if="defaultOpen[section.key]" class="border-t border-gray-100">
            <FeeLineItemsTable flush :tokens="BOOKING_TOKENS"
              :modelValue="getDefaultFees(section.key)"
              @update:modelValue="updateDefaultFees(section.key, $event)" />
          </div>
        </div>
      </div>
    </div>

    <!-- Pricing tiers -->
    <div>
      <div class="flex items-start justify-between mb-3">
        <div>
          <h3 class="text-sm font-semibold text-gray-800">Pricing tiers</h3>
          <p class="text-xs text-gray-400 mt-0.5">Different rates per group — inherits default unless overridden</p>
        </div>
        <button type="button"
          class="flex items-center gap-1.5 text-sm font-medium text-[#1E2157] hover:text-[#2a2f6e] transition-colors shrink-0"
          @click="addTier">
          <i class="pi pi-plus text-xs" />
          Add tier
        </button>
      </div>

      <div v-if="!tiers.length"
        class="text-center py-10 text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl">
        No pricing tiers yet. Add a tier to set different rates for specific groups.
      </div>

      <div v-else class="space-y-3">
        <div v-for="tier in tiers" :key="tier.id" class="border border-gray-200 rounded-xl overflow-hidden">

          <!-- Tier header -->
          <div class="px-4 py-3 flex items-center gap-3 bg-white">
            <button type="button" class="shrink-0 text-gray-400 hover:text-gray-600"
              @click="toggleTier(tier.id)">
              <i :class="`pi pi-chevron-${tierOpen[tier.id] ? 'up' : 'down'} text-xs`" />
            </button>
            <input :value="tier.name" type="text" placeholder="Tier name (e.g. Juniors)"
              class="flex-1 bg-transparent text-sm font-semibold text-gray-800 outline-none placeholder-gray-300 min-w-0"
              @input="patchTier(tier.id, 'name', ($event.target as HTMLInputElement).value)" />
            <button type="button" class="text-gray-300 hover:text-red-400 transition-colors shrink-0"
              @click="removeTier(tier.id)">
              <i class="pi pi-times text-xs" />
            </button>
          </div>

          <!-- Date range row -->
          <div class="px-4 pb-3 flex items-center gap-2 border-t border-gray-50 pt-2.5">
            <i class="pi pi-calendar text-gray-300 text-xs shrink-0" />
            <span class="text-xs text-gray-400 shrink-0">Valid from</span>
            <DatePicker
              :modelValue="tier.valid_from ? new Date(tier.valid_from) : null"
              dateFormat="d M yy"
              placeholder="Any date"
              showButtonBar
              :manualInput="false"
              inputClass="!text-xs !py-1 !px-2 !h-7 !w-28"
              class="shrink-0"
              @update:modelValue="v => patchTierDate(tier.id, 'valid_from', v)" />
            <span class="text-xs text-gray-400 shrink-0">to</span>
            <DatePicker
              :modelValue="tier.valid_until ? new Date(tier.valid_until) : null"
              dateFormat="d M yy"
              placeholder="Any date"
              showButtonBar
              :manualInput="false"
              inputClass="!text-xs !py-1 !px-2 !h-7 !w-28"
              class="shrink-0"
              @update:modelValue="v => patchTierDate(tier.id, 'valid_until', v)" />
            <span v-if="tier.valid_from || tier.valid_until" class="text-xs text-[#1E2157] ml-1">
              {{ tierDateSummary(tier) }}
            </span>
          </div>

          <!-- Criteria row -->
          <div class="px-4 pb-3 flex items-start gap-2 border-t border-gray-50 pt-2.5">
            <i class="pi pi-filter text-gray-300 text-xs shrink-0 mt-1.5" />
            <div class="flex flex-wrap gap-1.5 items-center flex-1">
              <!-- Existing rules as chips -->
              <div v-for="rule in (tier.criteria_rules ?? [])" :key="rule.id"
                class="flex items-center gap-1 text-xs bg-[rgba(30,33,90,0.06)] text-gray-700 rounded-full px-2.5 py-1">
                <span>{{ formatCriteriaRule(rule) }}</span>
                <button type="button" class="text-gray-400 hover:text-red-400 ml-0.5 leading-none"
                  @click="removeCriteriaRule(tier.id, rule.id)">
                  <i class="pi pi-times" style="font-size:0.6rem" />
                </button>
              </div>
              <!-- Inline new-rule editor -->
              <template v-if="addingRuleFor === tier.id">
                <select :value="newRule.field"
                  class="h-7 px-2 rounded-lg border border-gray-200 text-xs bg-white outline-none"
                  @change="onNewRuleFieldChange">
                  <option value="age">Age</option>
                  <option v-if="groups.length" value="group">Group</option>
                </select>
                <!-- Age operators -->
                <template v-if="newRule.field === 'age'">
                  <select v-model="newRule.operator"
                    class="h-7 px-2 rounded-lg border border-gray-200 text-xs bg-white outline-none">
                    <option value="gte">is at least</option>
                    <option value="lte">is at most</option>
                    <option value="eq">is exactly</option>
                    <option value="between">is between</option>
                  </select>
                  <input v-model.number="newRule.ageValue" type="number" min="0"
                    class="w-14 h-7 px-2 rounded-lg border border-gray-200 text-xs outline-none text-center" />
                  <template v-if="newRule.operator === 'between'">
                    <span class="text-xs text-gray-400">and</span>
                    <input v-model.number="newRule.ageValue2" type="number" min="0"
                      class="w-14 h-7 px-2 rounded-lg border border-gray-200 text-xs outline-none text-center" />
                  </template>
                </template>
                <!-- Group selector -->
                <template v-else-if="newRule.field === 'group'">
                  <span class="text-xs text-gray-400">is any of</span>
                  <MultiSelect
                    v-model="newRule.groupIds"
                    :options="groups"
                    optionLabel="name"
                    optionValue="id"
                    placeholder="Select groups…"
                    :maxSelectedLabels="2"
                    selectedItemsLabel="{0} groups"
                    size="small"
                    class="w-44" />
                </template>
                <button type="button"
                  class="h-7 px-2.5 rounded-lg bg-[#1E2157] text-white text-xs font-medium"
                  @click="confirmCriteriaRule(tier.id)">Add</button>
                <button type="button"
                  class="h-7 px-2 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50"
                  @click="addingRuleFor = null">Cancel</button>
              </template>
              <!-- Add rule button -->
              <button v-else type="button"
                class="flex items-center gap-1 text-xs text-gray-400 hover:text-[#1E2157] transition-colors"
                @click="startCriteriaRule(tier.id)">
                <i class="pi pi-plus text-xs" />
                Add criteria
              </button>
            </div>
          </div>

          <!-- Tier body -->
          <div v-if="tierOpen[tier.id]" class="border-t border-gray-100 divide-y divide-gray-50">

            <!-- Section overrides -->
            <div v-for="section in SECTIONS" :key="section.key">
              <div class="px-4 py-3 flex items-center gap-3">
                <span class="flex-1 text-sm font-medium text-gray-700">{{ section.label }}</span>
                <div class="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium shrink-0">
                  <button type="button"
                    class="px-3 py-1.5 transition-colors"
                    :class="getTierSection(tier.id, section.key) === null
                      ? 'bg-gray-100 text-gray-700'
                      : 'text-gray-400 hover:text-gray-600'"
                    @click="setTierOverride(tier.id, section.key, null)">
                    Inherit
                    <span v-if="defaultHasValue(section.key)" class="ml-1 font-normal opacity-60">
                      (${{ feeTotal(getDefaultFees(section.key)) }})
                    </span>
                  </button>
                  <button type="button"
                    class="px-3 py-1.5 border-l border-gray-200 transition-colors"
                    :class="getTierSection(tier.id, section.key) !== null
                      ? 'bg-[#1E2157] text-white'
                      : 'text-gray-400 hover:text-gray-600'"
                    @click="activateTierOverride(tier.id, section.key)">
                    Override
                  </button>
                </div>
              </div>
              <div v-if="getTierSection(tier.id, section.key) !== null" class="border-t border-gray-50">
                <FeeLineItemsTable flush :tokens="BOOKING_TOKENS"
                  :modelValue="getTierSection(tier.id, section.key)!"
                  @update:modelValue="updateTierSection(tier.id, section.key, $event)" />
              </div>
            </div>

            <!-- Add-on overrides -->
            <template v-if="addons.length">
              <div class="px-4 py-2.5 bg-gray-50/60">
                <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Add-on overrides</p>
              </div>
              <div v-for="addon in addons" :key="addon.id" class="border-t border-gray-50">
                <div class="px-4 py-3 flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-700">{{ addon.name || 'Unnamed add-on' }}</p>
                    <p v-if="parseFloat(feeTotal(addon.fees)) > 0"
                      class="text-xs text-gray-400">Default: ${{ feeTotal(addon.fees) }}</p>
                  </div>
                  <div class="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs font-medium shrink-0">
                    <button type="button"
                      class="px-3 py-1.5 transition-colors"
                      :class="getTierAddonOverride(tier.id, addon.id) === null
                        ? 'bg-gray-100 text-gray-700'
                        : 'text-gray-400 hover:text-gray-600'"
                      @click="setTierAddonOverride(tier.id, addon.id, null)">
                      Inherit
                    </button>
                    <button type="button"
                      class="px-3 py-1.5 border-l border-gray-200 transition-colors"
                      :class="getTierAddonOverride(tier.id, addon.id) !== null
                        ? 'bg-[#1E2157] text-white'
                        : 'text-gray-400 hover:text-gray-600'"
                      @click="activateTierAddonOverride(tier.id, addon.id)">
                      Override
                    </button>
                  </div>
                </div>
                <div v-if="getTierAddonOverride(tier.id, addon.id) !== null" class="border-t border-gray-50">
                  <FeeLineItemsTable flush :tokens="BOOKING_TOKENS"
                    :modelValue="getTierAddonOverride(tier.id, addon.id)!"
                    @update:modelValue="updateTierAddonOverride(tier.id, addon.id, $event)" />
                </div>
              </div>
            </template>

          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { feeTotal } from '~/composables/useFeeGroups'
import { BOOKING_TOKENS } from '~/composables/useBookingTokens'
import type { ModeAddon } from './ModeAddonsEditor.vue'

export interface CriteriaRule {
  id: string
  field: 'age' | 'group'
  operator: 'eq' | 'gte' | 'lte' | 'between' | 'in'
  value: number | string[]
  value2?: number
}

export interface PricingTier {
  id: string
  name: string
  criteria_rules: CriteriaRule[]
  valid_from: string | null
  valid_until: string | null
  base: FeeLineItem[] | null
  per_person: FeeLineItem[] | null
  per_hour: FeeLineItem[] | null
  addon_overrides: { addon_id: string; fees: FeeLineItem[] }[]
}

export interface ModePricingWithTiers {
  base: FeeLineItem[]
  per_person: FeeLineItem[]
  per_hour: FeeLineItem[]
  tiers: PricingTier[]
}

const props = defineProps<{
  modelValue: ModePricingWithTiers
  addons: ModeAddon[]
  groups: { id: string; name: string; color: string | null }[]
}>()

const emit = defineEmits<{ 'update:modelValue': [ModePricingWithTiers] }>()

const SECTIONS = [
  { key: 'base',       label: 'Per booking', subtitle: 'Flat fee charged once per booking' },
  { key: 'per_person', label: 'Per person',  subtitle: 'Multiplied by headcount' },
  { key: 'per_hour',   label: 'Per hour',    subtitle: 'Multiplied by duration in hours' },
] as const

// ── Default pricing ──────────────────────────────────────────

const defaultOpen = reactive<Record<string, boolean>>({ base: false, per_person: false, per_hour: false })

watch(() => props.modelValue, (val) => {
  if ((val?.base?.length ?? 0) > 0) defaultOpen.base = true
  if ((val?.per_person?.length ?? 0) > 0) defaultOpen.per_person = true
  if ((val?.per_hour?.length ?? 0) > 0) defaultOpen.per_hour = true
}, { immediate: true })

function toggleDefault(key: string) { defaultOpen[key] = !defaultOpen[key] }

function getDefaultFees(key: string): FeeLineItem[] {
  return ((props.modelValue as any)[key] as FeeLineItem[]) ?? []
}

function defaultHasValue(key: string): boolean {
  return getDefaultFees(key).some(f => f.amount != null && f.amount > 0)
}

function updateDefaultFees(key: string, fees: FeeLineItem[]) {
  emit('update:modelValue', { ...props.modelValue, [key]: fees })
}

// ── Tiers ────────────────────────────────────────────────────

const tiers = computed(() => props.modelValue.tiers ?? [])
const tierOpen = reactive<Record<string, boolean>>({})

function toggleTier(id: string) { tierOpen[id] = !tierOpen[id] }

function addTier() {
  const id = crypto.randomUUID()
  tierOpen[id] = true
  const newTier: PricingTier = {
    id, name: '', criteria_rules: [],
    valid_from: null, valid_until: null,
    base: null, per_person: null, per_hour: null,
    addon_overrides: [],
  }
  emit('update:modelValue', { ...props.modelValue, tiers: [...tiers.value, newTier] })
}

// ── Criteria rules ───────────────────────────────────────────

const addingRuleFor = ref<string | null>(null)
const newRule = reactive({
  field: 'age' as 'age' | 'group',
  operator: 'gte' as 'eq' | 'gte' | 'lte' | 'between' | 'in',
  ageValue: 18,
  ageValue2: 65,
  groupIds: [] as string[],
})

function startCriteriaRule(tierId: string) {
  newRule.field = 'age'
  newRule.operator = 'gte'
  newRule.ageValue = 18
  newRule.ageValue2 = 65
  newRule.groupIds = []
  addingRuleFor.value = tierId
}

function onNewRuleFieldChange(e: Event) {
  const field = (e.target as HTMLSelectElement).value as 'age' | 'group'
  newRule.field = field
  newRule.operator = field === 'group' ? 'in' : 'gte'
}

function confirmCriteriaRule(tierId: string) {
  const tier = tiers.value.find(t => t.id === tierId)
  if (!tier) return
  let rule: CriteriaRule
  if (newRule.field === 'group') {
    if (!newRule.groupIds.length) return
    rule = { id: crypto.randomUUID(), field: 'group', operator: 'in', value: [...newRule.groupIds] }
  } else {
    rule = {
      id: crypto.randomUUID(), field: 'age', operator: newRule.operator,
      value: newRule.ageValue,
      ...(newRule.operator === 'between' ? { value2: newRule.ageValue2 } : {}),
    }
  }
  patchTier(tierId, 'criteria_rules', [...(tier.criteria_rules ?? []), rule])
  addingRuleFor.value = null
}

function removeCriteriaRule(tierId: string, ruleId: string) {
  const tier = tiers.value.find(t => t.id === tierId)
  if (!tier) return
  patchTier(tierId, 'criteria_rules', (tier.criteria_rules ?? []).filter(r => r.id !== ruleId))
}

const OP_LABELS: Record<string, string> = {
  eq: 'is exactly', gte: 'is at least', lte: 'is at most', between: 'is between',
}

function formatCriteriaRule(rule: CriteriaRule): string {
  if (rule.field === 'group') {
    const ids = rule.value as string[]
    const names = ids.map(id => props.groups.find(g => g.id === id)?.name ?? id)
    return names.length === 1 ? `Group is ${names[0]}` : `Group is any of ${names.join(', ')}`
  }
  const op = OP_LABELS[rule.operator] ?? rule.operator
  if (rule.operator === 'between') return `Age ${op} ${rule.value} and ${rule.value2}`
  return `Age ${op} ${rule.value}`
}

// ── Date helpers ─────────────────────────────────────────────

function patchTierDate(tierId: string, field: 'valid_from' | 'valid_until', date: Date | null) {
  const value = date ? date.toISOString().split('T')[0] : null
  patchTier(tierId, field, value)
}

function tierDateSummary(tier: PricingTier): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  if (tier.valid_from && tier.valid_until) return `${fmt(tier.valid_from)} – ${fmt(tier.valid_until)}`
  if (tier.valid_from) return `From ${fmt(tier.valid_from)}`
  if (tier.valid_until) return `Until ${fmt(tier.valid_until)}`
  return ''
}

function removeTier(id: string) {
  delete tierOpen[id]
  emit('update:modelValue', { ...props.modelValue, tiers: tiers.value.filter(t => t.id !== id) })
}

function patchTier(id: string, field: keyof PricingTier, value: any) {
  emit('update:modelValue', {
    ...props.modelValue,
    tiers: tiers.value.map(t => t.id === id ? { ...t, [field]: value } : t),
  })
}

function getTierSection(tierId: string, key: string): FeeLineItem[] | null {
  const tier = tiers.value.find(t => t.id === tierId)
  return tier ? ((tier as any)[key] as FeeLineItem[] | null) : null
}

function setTierOverride(tierId: string, key: string, fees: FeeLineItem[] | null) {
  patchTier(tierId, key as keyof PricingTier, fees)
}

function activateTierOverride(tierId: string, key: string) {
  if (getTierSection(tierId, key) === null) {
    patchTier(tierId, key as keyof PricingTier, [])
  }
}

function updateTierSection(tierId: string, key: string, fees: FeeLineItem[]) {
  patchTier(tierId, key as keyof PricingTier, fees)
}

// ── Add-on overrides ─────────────────────────────────────────

function getTierAddonOverride(tierId: string, addonId: string): FeeLineItem[] | null {
  const tier = tiers.value.find(t => t.id === tierId)
  if (!tier) return null
  const override = tier.addon_overrides.find(o => o.addon_id === addonId)
  return override ? override.fees : null
}

function setTierAddonOverride(tierId: string, addonId: string, fees: FeeLineItem[] | null) {
  const tier = tiers.value.find(t => t.id === tierId)
  if (!tier) return
  let overrides = [...tier.addon_overrides]
  if (fees === null) {
    overrides = overrides.filter(o => o.addon_id !== addonId)
  } else {
    const existing = overrides.findIndex(o => o.addon_id === addonId)
    if (existing >= 0) overrides[existing] = { addon_id: addonId, fees }
    else overrides = [...overrides, { addon_id: addonId, fees }]
  }
  patchTier(tierId, 'addon_overrides', overrides)
}

function activateTierAddonOverride(tierId: string, addonId: string) {
  if (getTierAddonOverride(tierId, addonId) === null) {
    setTierAddonOverride(tierId, addonId, [])
  }
}

function updateTierAddonOverride(tierId: string, addonId: string, fees: FeeLineItem[]) {
  setTierAddonOverride(tierId, addonId, fees)
}
</script>
