<!--
  Fee-options editor for the term wizard's Fees step. Each fee OPTION is a
  bordered block whose line items are edited with the REAL standard fees table
  (<FeeLineItemsTable> — drag handles, Fee Name / Account / Amount columns,
  Total row, "+ Add Fee"), so it looks identical to fees everywhere else.

  Items use the FeeLineItem shape ({ id, name, xero_code, amount }). Rows carry
  their carried-over seed (initName/initTotal): an edited option shows the old
  total as a subtle muted strikethrough in its header, new options get a quiet
  "new" chip. `readonly` renders a plain display table (used while a
  programme's fees are locked to "keep"). Mutates `rows`; emits `change`.
-->
<template>
  <div class="space-y-2">
    <div v-for="r in rows" :key="r.key" class="rounded-lg border border-gray-200 overflow-hidden">
      <!-- Option header: name + changed/new markers + remove -->
      <div class="flex items-center gap-2 px-3 py-2 bg-gray-50/60 border-b border-gray-100">
        <input v-if="!readonly" v-model="r.name" type="text" placeholder="Fee name" @input="emitChange"
          class="flex-1 min-w-0 text-sm font-medium text-gray-800 bg-transparent border border-transparent hover:border-gray-200 focus:border-[#1E2157] focus:bg-white focus:ring-1 focus:ring-[#1E2157] rounded-md px-1.5 py-0.5 -mx-1.5 outline-none transition-colors" />
        <span v-else class="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{{ r.name || 'Fee' }}</span>
        <span v-if="isNew(r)" class="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 shrink-0">new</span>
        <button v-if="!readonly" type="button" class="text-gray-300 hover:text-red-500 shrink-0" title="Remove this fee option" @click="removeRow(r.key)"><i class="pi pi-times-circle text-sm" /></button>
      </div>
      <!-- Line items: the standard fees table (edit) or a plain display (locked) -->
      <FeeLineItemsTable v-if="!readonly" :model-value="r.items" flush :baseline="baseline"
        @update:modelValue="(v: FeeLineItem[]) => { r.items = v; emitChange() }" />
      <div v-else>
        <div class="grid grid-cols-[1fr_140px_120px] gap-x-2 px-4 py-2 border-b border-gray-100">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee name</span>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</span>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Amount</span>
        </div>
        <div v-for="it in r.items" :key="it.id" class="grid grid-cols-[1fr_140px_120px] gap-x-2 px-4 py-1.5 border-b border-gray-50">
          <span class="text-sm text-gray-700 truncate">{{ it.name || '—' }}</span>
          <span class="text-sm text-gray-400 num">{{ it.xero_code || '—' }}</span>
          <span class="text-sm text-gray-700 tabular-nums text-right">{{ fmtMoney(it.amount ?? 0, currency) }}</span>
        </div>
        <div class="flex items-center justify-between px-4 py-2 bg-gray-50/60">
          <span class="text-sm font-semibold text-gray-800">Total</span>
          <span class="text-sm font-semibold text-gray-900 tabular-nums">{{ fmtMoney(total(r), currency) }}</span>
        </div>
      </div>
    </div>
    <p v-if="!rows.length" class="text-sm text-gray-400 py-1">No fee — this class is free to join.</p>
    <button v-if="!readonly && !hideAdd" type="button" class="text-xs font-medium text-primary hover:underline" @click="addRow">+ Fee option</button>
  </div>
</template>

<script setup lang="ts">
import { useGroupFees } from '~/composables/useGroupFees'
import type { FeeLineItem } from '~/composables/useFeeGroups'

interface FeeRow { key: number; name: string; items: FeeLineItem[]; initName?: string; initTotal?: number | null }

const props = defineProps<{ rows: FeeRow[]; currency: string; readonly?: boolean; hideAdd?: boolean; baseline?: Record<string, Partial<FeeLineItem>> }>()
const emit = defineEmits<{ (e: 'change'): void }>()
const { fmtMoney } = useGroupFees()

let uid = Date.now() % 1000000

function emitChange() { emit('change') }
function total(r: FeeRow) { return r.items.reduce((n, i) => n + (i.amount ?? 0), 0) }
function isNew(r: FeeRow) { return r.initTotal === undefined }
function changed(r: FeeRow) {
  return r.initTotal !== undefined && (total(r) !== (r.initTotal ?? 0) || r.name.trim() !== (r.initName ?? '').trim())
}
function addRow() {
  props.rows.push({ key: ++uid, name: '', items: [] })   // FeeLineItemsTable seeds its first empty row
  emitChange()
}
function removeRow(key: number) {
  const i = props.rows.findIndex(r => r.key === key)
  if (i >= 0) props.rows.splice(i, 1)
  emitChange()
}
</script>
