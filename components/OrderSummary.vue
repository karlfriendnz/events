<template>
  <!-- THE shared order summary — used by the builder preview, the in-app preview, and
       the live registration page, so the price a club designs = the price a registrant
       is quoted, rendered identically everywhere. Feed it computed lines/discounts/total;
       it owns only the presentation. -->
  <div class="space-y-1">
    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{{ heading || 'Order Summary' }}</p>
    <div v-for="(row, i) in lines" :key="'l' + i" class="flex items-center text-sm">
      <span class="flex-1 text-gray-500 truncate pr-2">{{ row.label }}</span>
      <span class="tabular-nums text-right shrink-0" :class="row.amount < 0 ? 'text-green-600 font-medium' : 'text-gray-700'">
        {{ row.amount < 0 ? '-' : '' }}{{ money(Math.abs(row.amount)) }}
      </span>
    </div>
    <!-- Discounts (sibling / whole-week / promo …) — always shown as a credit. -->
    <div v-for="(d, i) in (discounts ?? [])" :key="'d' + i" class="flex items-center text-sm">
      <span class="flex-1 text-green-600 truncate pr-2">{{ d.label }}</span>
      <span class="tabular-nums text-right shrink-0 text-green-600 font-medium">-{{ money(Math.abs(d.amount)) }}</span>
    </div>
    <div class="flex items-center pt-1.5 mt-0.5 border-t border-gray-100 text-sm font-bold">
      <span class="flex-1 text-gray-700">{{ totalLabel || 'Total' }}</span>
      <span class="tabular-nums text-right shrink-0 text-primary">{{ money(Math.max(0, total)) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  /** Itemized charge rows (positive = charge, negative = credit). */
  lines: { label: string; amount: number }[]
  /** Discount lines — `amount` is the magnitude; rendered as a credit. */
  discounts?: { label: string; amount: number }[]
  /** The net total to show on the Total row. */
  total: number
  /** ISO currency code (org currency); defaults to NZD. */
  currency?: string
  heading?: string
  totalLabel?: string
}>()

function money(n: number) {
  const cur = props.currency || 'NZD'
  try { return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: cur }).format(n || 0) }
  catch { return `$${(n || 0).toFixed(2)}` }
}
</script>
