<template>
  <div class="space-y-2">
    <div v-for="addon in modelValue" :key="addon.id"
      class="border border-gray-200 rounded-xl overflow-hidden">

      <!-- Header row -->
      <div class="px-4 py-3 flex items-center gap-3 bg-white">
        <button type="button" class="flex-1 flex items-center gap-3 min-w-0 text-left"
          @click="toggleAddon(addon.id)">
          <i :class="`pi pi-chevron-${expanded[addon.id] ? 'up' : 'down'} text-gray-400 text-xs shrink-0`" />
          <span class="text-sm font-medium text-gray-800 flex-1 truncate">
            {{ addon.name || 'Unnamed add-on' }}
          </span>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
            :class="typeStyle(addon.type).class">
            {{ typeStyle(addon.type).label }}
          </span>
          <span class="text-sm font-semibold tabular-nums shrink-0"
            :class="addonTotal(addon) !== '0.00' ? 'text-gray-800' : 'text-gray-300'">
            ${{ addonTotal(addon) }}
          </span>
        </button>
        <button type="button" class="text-gray-300 hover:text-red-400 transition-colors shrink-0"
          @click="remove(addon.id)">
          <i class="pi pi-times text-xs" />
        </button>
      </div>

      <!-- Expanded body -->
      <div v-if="expanded[addon.id]" class="border-t border-gray-100">
        <div class="p-4 space-y-3">
          <div class="flex gap-3 flex-wrap">
            <div class="flex-1 min-w-[140px] flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-500">Name</label>
              <input :value="addon.name" type="text" placeholder="e.g. Food package"
                class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-200 transition"
                @input="patch(addon, 'name', ($event.target as HTMLInputElement).value)" />
            </div>
            <div class="w-40 flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-500">Type</label>
              <select :value="addon.type"
                class="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200 transition"
                @change="patch(addon, 'type', ($event.target as HTMLSelectElement).value)">
                <option value="fee_base">One-off fee</option>
                <option value="fee_per_booking">Fee per booking</option>
                <option value="fee_per_person">Fee per person</option>
                <option value="fee_per_hour">Fee per hour</option>
                <option value="item">Physical item / equipment</option>
              </select>
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500">Description <span class="font-normal text-gray-400">(shown to bookers)</span></label>
            <input :value="addon.description" type="text" placeholder="e.g. Catering for all guests, includes tea & coffee"
              class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-200 transition"
              @input="patch(addon, 'description', ($event.target as HTMLInputElement).value)" />
          </div>

          <!-- Quantity (for physical items) -->
          <div v-if="addon.type === 'item'" class="flex gap-3">
            <div class="w-28 flex flex-col gap-1">
              <label class="text-xs font-medium text-gray-500">Qty available</label>
              <input :value="addon.qty_available ?? ''" type="number" min="1" placeholder="e.g. 10"
                class="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-200 transition"
                @input="patch(addon, 'qty_available', parseInt(($event.target as HTMLInputElement).value) || null)" />
            </div>
          </div>

          <!-- Tiered pricing (per-person + item only) -->
          <div v-if="addon.type === 'fee_per_person' || addon.type === 'item'">
            <div class="flex items-center justify-between">
              <label class="text-xs font-medium text-gray-500">Tiered pricing</label>
              <ToggleSwitch :modelValue="!!addon.tiers?.length"
                @update:modelValue="onToggleTiers(addon, $event)" />
            </div>
            <p v-if="!addon.tiers?.length" class="text-[11px] text-gray-400 mt-1">
              Off — every {{ addon.type === 'fee_per_person' ? 'attendee' : 'unit' }} is charged the same flat price below.
            </p>
            <div v-else class="mt-2 space-y-2">
              <p class="text-[11px] text-gray-400">
                Brackets are evaluated in order. The last row covers everything beyond the previous bracket.
              </p>
              <div v-for="(tier, ti) in addon.tiers" :key="ti"
                class="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50/40">
                <span class="text-xs text-gray-500 w-12 shrink-0">{{ rangeLabel(addon.tiers, ti) }}</span>
                <span class="text-xs text-gray-400">up to</span>
                <input v-if="ti < addon.tiers.length - 1"
                  :value="tier.up_to ?? ''" type="number" min="1" placeholder="—"
                  class="w-20 h-8 px-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200"
                  @input="patchTier(addon, ti, { up_to: parseInt(($event.target as HTMLInputElement).value) || null })" />
                <span v-else class="text-xs text-gray-500 italic">no limit</span>
                <span class="text-xs text-gray-400">·</span>
                <span class="text-xs text-gray-500">$</span>
                <input :value="tier.unit_price ?? ''" type="number" min="0" step="0.01" placeholder="0.00"
                  class="w-24 h-8 px-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-200"
                  @input="patchTier(addon, ti, { unit_price: parseFloat(($event.target as HTMLInputElement).value) || 0 })" />
                <span class="text-xs text-gray-400 flex-1">
                  per {{ addon.type === 'fee_per_person' ? 'person' : 'unit' }}
                </span>
                <button v-if="addon.tiers.length > 1" type="button"
                  class="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500"
                  @click="removeTier(addon, ti)">
                  <i class="pi pi-times text-xs" />
                </button>
              </div>
              <button type="button"
                class="text-xs text-primary hover:underline flex items-center gap-1"
                @click="addTier(addon)">
                <i class="pi pi-plus text-[10px]" /> Add bracket
              </button>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-100">
          <FeeLineItemsTable
            flush
            :modelValue="addon.fees"
            @update:modelValue="patch(addon, 'fees', $event)" />
        </div>
      </div>
    </div>

    <button type="button"
      class="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors py-1"
      @click="addAddon">
      <i class="pi pi-plus text-xs" />
      Add add-on
    </button>
  </div>
</template>

<script setup lang="ts">
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { feeTotal } from '~/composables/useFeeGroups'

export interface PricingTier {
  /** Inclusive upper bound. `null` on the final tier means "no limit". */
  up_to: number | null
  /** Charge per unit for items in this tier (use 0 for "free"). */
  unit_price: number
}
export interface ModeAddon {
  id: string
  name: string
  description: string
  type: 'fee_base' | 'fee_per_booking' | 'fee_per_person' | 'fee_per_hour' | 'item'
  fees: FeeLineItem[]
  qty_available?: number | null
  /**
   * Tiered pricing for per-person and item add-ons. Tiers are applied in order:
   * 1..tier[0].up_to → tier[0].unit_price, tier[0].up_to+1..tier[1].up_to → tier[1].unit_price, etc.
   * The last tier should have `up_to: null` to cover everything above. When omitted/empty,
   * `fees` is treated as the flat unit price across all units.
   */
  tiers?: PricingTier[]
}

const props = defineProps<{ modelValue: ModeAddon[] }>()
const emit = defineEmits<{ 'update:modelValue': [ModeAddon[]] }>()

const expanded = reactive<Record<string, boolean>>({})

function toggleAddon(id: string) {
  expanded[id] = !expanded[id]
}

function addonTotal(addon: ModeAddon) {
  return feeTotal(addon.fees)
}

const TYPE_STYLES: Record<string, { label: string; class: string }> = {
  fee_base:        { label: 'One-off',     class: 'bg-gray-100 text-gray-600' },
  fee_per_booking: { label: 'Per booking', class: 'bg-blue-50 text-blue-600' },
  fee_per_person:  { label: 'Per person',  class: 'bg-purple-50 text-purple-600' },
  fee_per_hour:    { label: 'Per hour',    class: 'bg-amber-50 text-amber-600' },
  item:            { label: 'Equipment',   class: 'bg-emerald-50 text-emerald-600' },
}

function typeStyle(type: string) {
  return TYPE_STYLES[type] ?? TYPE_STYLES.fee_base
}

function addAddon() {
  const id = crypto.randomUUID()
  expanded[id] = true
  emit('update:modelValue', [
    ...props.modelValue,
    { id, name: '', description: '', type: 'fee_base', fees: [], qty_available: null },
  ])
}

function remove(id: string) {
  delete expanded[id]
  emit('update:modelValue', props.modelValue.filter(a => a.id !== id))
}

function patch(addon: ModeAddon, field: keyof ModeAddon, value: any) {
  emit('update:modelValue', props.modelValue.map(a => a.id === addon.id ? { ...a, [field]: value } : a))
}

function onToggleTiers(addon: ModeAddon, on: boolean) {
  if (on) {
    // Seed with one open-ended tier using the current flat price.
    const flat = (addon.fees ?? []).reduce((s, f) => s + (f.amount ?? 0), 0)
    patch(addon, 'tiers', [{ up_to: null, unit_price: flat }])
  } else {
    patch(addon, 'tiers', undefined)
  }
}
function patchTier(addon: ModeAddon, index: number, partial: Partial<PricingTier>) {
  const next = (addon.tiers ?? []).map((t, i) => i === index ? { ...t, ...partial } : t)
  patch(addon, 'tiers', next)
}
function addTier(addon: ModeAddon) {
  const tiers = [...(addon.tiers ?? [])]
  // Convert previous "no limit" tier into a bounded one (using its current price as a sensible
  // anchor). The new last tier is the unbounded one.
  const last = tiers[tiers.length - 1]
  if (last && last.up_to === null) {
    last.up_to = (tiers.length - 1 >= 0 && tiers[tiers.length - 2]?.up_to)
      ? (tiers[tiers.length - 2]!.up_to as number) + 5
      : 5
  }
  tiers.push({ up_to: null, unit_price: last?.unit_price ?? 0 })
  patch(addon, 'tiers', tiers)
}
function removeTier(addon: ModeAddon, index: number) {
  const next = (addon.tiers ?? []).filter((_, i) => i !== index)
  // Ensure last tier is unbounded.
  if (next.length) next[next.length - 1].up_to = null
  patch(addon, 'tiers', next.length ? next : undefined)
}
function rangeLabel(tiers: PricingTier[] | undefined, index: number): string {
  if (!tiers) return ''
  const prev = index > 0 ? (tiers[index - 1].up_to ?? 0) : 0
  const start = prev + 1
  const cur = tiers[index].up_to
  if (cur === null) return `${start}+`
  return start === cur ? `${start}` : `${start}–${cur}`
}
</script>
