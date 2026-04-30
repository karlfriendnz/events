<template>
  <div class="space-y-2">
    <div v-for="section in sections" :key="section.key"
      class="border border-gray-200 rounded-xl overflow-hidden">

      <!-- Header -->
      <button type="button"
        class="w-full px-4 py-3 flex items-center gap-3 bg-white hover:bg-gray-50 transition-colors text-left"
        @click="toggle(section.key)">
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-800">{{ section.label }}</p>
          <p class="text-xs text-gray-400 mt-0.5">{{ section.subtitle }}</p>
        </div>
        <span class="text-sm font-semibold shrink-0 tabular-nums"
          :class="sectionHasValue(section.key) ? 'text-gray-800' : 'text-gray-300'">
          {{ sectionHasValue(section.key) ? sectionSummary(section.key) : '—' }}
        </span>
        <i :class="`pi pi-chevron-${open[section.key] ? 'up' : 'down'} text-gray-400 text-xs shrink-0`" />
      </button>

      <!-- Expanded: base (always flat) -->
      <div v-if="open[section.key] && section.key === 'base'" class="border-t border-gray-100">
        <FeeLineItemsTable flush
          :modelValue="modelValue.base ?? []"
          @update:modelValue="updateBase($event)" />
      </div>

      <!-- Expanded: per_person / per_hour -->
      <div v-else-if="open[section.key]" class="border-t border-gray-100">

        <!-- Group toggle -->
        <div class="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <ToggleSwitch
            :modelValue="!getSection(section.key).all_equal"
            size="small"
            @update:modelValue="setByGroup(section.key, $event)" />
          <span class="text-xs font-medium text-gray-600">Different rates per group</span>
        </div>

        <!-- All equal: single table -->
        <FeeLineItemsTable v-if="getSection(section.key).all_equal"
          flush
          :modelValue="getSection(section.key).fees"
          @update:modelValue="updateSectionFees(section.key, $event)" />

        <!-- By group -->
        <template v-else>
          <div v-for="group in getSection(section.key).groups" :key="group.id"
            class="border-b border-gray-100 last:border-0">
            <!-- Group label row -->
            <div class="px-4 py-2.5 flex items-center gap-3 bg-gray-50/60">
              <input :value="group.label" type="text" placeholder="Group name"
                class="flex-1 bg-transparent text-sm font-semibold text-gray-700 outline-none placeholder-gray-300"
                @input="updateGroupLabel(section.key, group.id, ($event.target as HTMLInputElement).value)" />
              <span class="text-xs font-semibold tabular-nums text-gray-500"
                :class="parseFloat(groupTotal(group)) > 0 ? 'text-gray-700' : 'text-gray-300'">
                ${{ groupTotal(group) }}
              </span>
              <button type="button" class="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                @click="removeGroup(section.key, group.id)">
                <i class="pi pi-times text-xs" />
              </button>
            </div>
            <FeeLineItemsTable flush
              :modelValue="group.fees"
              @update:modelValue="updateGroupFees(section.key, group.id, $event)" />
          </div>

          <!-- Add group row -->
          <div class="px-4 py-3 flex items-center gap-3 flex-wrap">
            <button type="button"
              class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1E2157] transition-colors"
              @click="addGroup(section.key, '')">
              <i class="pi pi-plus text-xs" />
              Add group
            </button>
            <span class="text-gray-200 text-xs">|</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button v-for="preset in availablePresets(section.key)" :key="preset"
                type="button"
                class="text-xs px-2.5 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-[#1E2157] hover:text-[#1E2157] transition-colors"
                @click="addGroup(section.key, preset)">
                + {{ preset }}
              </button>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { feeTotal } from '~/composables/useFeeGroups'

export interface PricingGroup {
  id: string
  label: string
  fees: FeeLineItem[]
}

export interface PricingSection {
  all_equal: boolean
  fees: FeeLineItem[]
  groups: PricingGroup[]
}

export interface ModePricing {
  base: FeeLineItem[]
  per_person: PricingSection
  per_hour: PricingSection
}

const PRESET_GROUPS = ['Member', 'Guest', 'Public']

const props = defineProps<{ modelValue: ModePricing }>()
const emit = defineEmits<{ 'update:modelValue': [ModePricing] }>()

const sections = [
  { key: 'base',       label: 'Per booking', subtitle: 'Flat fee charged once per booking' },
  { key: 'per_person', label: 'Per person',  subtitle: 'Multiplied by headcount at booking time' },
  { key: 'per_hour',   label: 'Per hour',    subtitle: 'Multiplied by duration in hours' },
] as const

const open = reactive<Record<string, boolean>>({ base: false, per_person: false, per_hour: false })

function normalizeSection(val: any): PricingSection {
  if (!val || Array.isArray(val)) return { all_equal: true, fees: val ?? [], groups: [] }
  return { all_equal: val.all_equal ?? true, fees: val.fees ?? [], groups: val.groups ?? [] }
}

function getSection(key: string): PricingSection {
  return normalizeSection((props.modelValue as any)[key])
}

watch(() => props.modelValue, (val) => {
  if ((val?.base?.length ?? 0) > 0) open.base = true
  const pp = normalizeSection(val?.per_person)
  if (pp.fees.length || pp.groups.some(g => g.fees.length)) open.per_person = true
  const ph = normalizeSection(val?.per_hour)
  if (ph.fees.length || ph.groups.some(g => g.fees.length)) open.per_hour = true
}, { immediate: true })

function toggle(key: string) { open[key] = !open[key] }

function sectionHasValue(key: string): boolean {
  if (key === 'base') return (props.modelValue.base ?? []).some(f => f.amount != null && f.amount > 0)
  const s = getSection(key)
  if (s.all_equal) return s.fees.some(f => f.amount != null && f.amount > 0)
  return s.groups.some(g => g.fees.some(f => f.amount != null && f.amount > 0))
}

function sectionSummary(key: string): string {
  if (key === 'base') return `$${feeTotal(props.modelValue.base ?? [])}`
  const s = getSection(key)
  if (s.all_equal) return `$${feeTotal(s.fees)}`
  const totals = s.groups.filter(g => g.fees.some(f => f.amount != null && f.amount > 0))
    .map(g => parseFloat(feeTotal(g.fees)))
  if (!totals.length) return '—'
  const min = Math.min(...totals), max = Math.max(...totals)
  return min === max ? `$${min.toFixed(2)}` : `$${min.toFixed(2)} – $${max.toFixed(2)}`
}

function groupTotal(group: PricingGroup): string {
  return feeTotal(group.fees)
}

function availablePresets(key: string): string[] {
  const existing = new Set(getSection(key).groups.map(g => g.label))
  return PRESET_GROUPS.filter(p => !existing.has(p))
}

function updateBase(fees: FeeLineItem[]) {
  emit('update:modelValue', { ...props.modelValue, base: fees })
}

function updateSection(key: string, section: PricingSection) {
  emit('update:modelValue', { ...props.modelValue, [key]: section })
}

function updateSectionFees(key: string, fees: FeeLineItem[]) {
  updateSection(key, { ...getSection(key), fees })
}

function setByGroup(key: string, byGroup: boolean) {
  const s = getSection(key)
  const updated: PricingSection = { ...s, all_equal: !byGroup }
  if (byGroup && !s.groups.length) {
    updated.groups = PRESET_GROUPS.map(label => ({ id: crypto.randomUUID(), label, fees: [] }))
  }
  updateSection(key, updated)
}

function addGroup(key: string, label: string) {
  const s = getSection(key)
  updateSection(key, { ...s, groups: [...s.groups, { id: crypto.randomUUID(), label, fees: [] }] })
}

function removeGroup(key: string, groupId: string) {
  const s = getSection(key)
  updateSection(key, { ...s, groups: s.groups.filter(g => g.id !== groupId) })
}

function updateGroupLabel(key: string, groupId: string, label: string) {
  const s = getSection(key)
  updateSection(key, { ...s, groups: s.groups.map(g => g.id === groupId ? { ...g, label } : g) })
}

function updateGroupFees(key: string, groupId: string, fees: FeeLineItem[]) {
  const s = getSection(key)
  updateSection(key, { ...s, groups: s.groups.map(g => g.id === groupId ? { ...g, fees } : g) })
}
</script>
