<template>
  <div class="rounded-xl border border-gray-200 overflow-hidden bg-white">
    <table class="w-full text-sm table-fixed">
      <colgroup>
        <col class="w-8" />
        <col />
        <col class="w-44" />
        <col class="w-36" />
        <col class="w-10" />
      </colgroup>
      <thead>
        <tr class="bg-gray-50 border-b border-gray-200">
          <th />
          <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fee Name</th>
          <th class="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Account</th>
          <th class="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
          <th />
        </tr>
      </thead>
      <tbody ref="tbodyEl" class="divide-y divide-gray-100">
        <tr v-for="fee in modelValue" :key="fee.id" :data-id="fee.id" class="group/row">
          <td class="p-0">
            <div class="drag-handle w-8 h-10 flex items-center justify-center cursor-grab active:cursor-grabbing">
              <i class="pi pi-bars text-gray-300 text-xs" />
            </div>
          </td>
          <td class="p-0">
            <input
              :value="fee.name"
              type="text"
              placeholder="Enter fee name"
              class="w-full h-10 px-4 text-sm text-gray-800 placeholder-gray-400 bg-transparent border-0 outline-none focus:bg-blue-50/40 transition-colors"
              @input="setField(fee, 'name', ($event.target as HTMLInputElement).value)" />
          </td>
          <td class="p-0 border-l border-gray-100">
            <input
              :value="fee.xero_code"
              type="text"
              placeholder="Account code"
              class="w-full h-10 px-4 text-sm text-gray-800 placeholder-gray-400 bg-transparent border-0 outline-none focus:bg-blue-50/40 transition-colors"
              @input="setField(fee, 'xero_code', ($event.target as HTMLInputElement).value)" />
          </td>
          <td class="p-0 border-l border-gray-100">
            <div class="flex items-center h-10 px-3 gap-1 focus-within:bg-blue-50/40 transition-colors">
              <span class="text-gray-400 shrink-0 text-sm">$</span>
              <input
                :value="fee.amount != null ? fee.amount : ''"
                type="text"
                inputmode="decimal"
                placeholder="0.00"
                class="flex-1 min-w-0 text-right text-sm text-gray-800 placeholder-gray-400 bg-transparent border-0 outline-none"
                @change="(e) => { const v = parseFloat((e.target as HTMLInputElement).value); setField(fee, 'amount', isNaN(v) ? null : Math.round(v * 100) / 100) }"
                @blur="(e) => { const el = e.target as HTMLInputElement; if (fee.amount != null) el.value = fee.amount.toFixed(2) }" />
            </div>
          </td>
          <td class="p-0 border-l border-gray-100 text-center">
            <button
              type="button"
              class="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 transition-colors"
              @click="removeFee(fee)">
              <i class="pi pi-trash text-xs" />
            </button>
          </td>
        </tr>

        <!-- Total row (excluded from sortable via data-no-sort) -->
        <tr class="border-t-2 border-gray-200 bg-gray-50" data-no-sort>
          <td />
          <td class="px-4 py-2.5 text-sm font-semibold text-gray-800">Total</td>
          <td />
          <td class="px-4 py-2.5 text-sm font-semibold text-gray-800 text-right">${{ total }}</td>
          <td />
        </tr>
      </tbody>
    </table>

    <!-- Add fee -->
    <div class="px-4 py-2.5 border-t border-gray-100">
      <button
        type="button"
        class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1E2157] transition-colors"
        @click="addFee">
        <i class="pi pi-plus text-xs" />
        <span>Add Fee</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Sortable from 'sortablejs'
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { feeTotal } from '~/composables/useFeeGroups'

const props = defineProps<{
  modelValue: FeeLineItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [FeeLineItem[]]
}>()

const total = computed(() => feeTotal(props.modelValue))
const tbodyEl = ref<HTMLElement | null>(null)

onMounted(() => {
  if (!props.modelValue.length) addFee()

  if (tbodyEl.value) {
    Sortable.create(tbodyEl.value, {
      handle: '.drag-handle',
      filter: '[data-no-sort]',
      animation: 150,
      onEnd({ oldIndex, newIndex }) {
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
        const items = [...props.modelValue]
        const [moved] = items.splice(oldIndex, 1)
        items.splice(newIndex, 0, moved)
        emit('update:modelValue', items)
      },
    })
  }
})

function addFee() {
  emit('update:modelValue', [
    ...props.modelValue,
    { id: crypto.randomUUID(), name: '', xero_code: '', amount: null },
  ])
}

function removeFee(fee: FeeLineItem) {
  emit('update:modelValue', props.modelValue.filter(f => f.id !== fee.id))
}

function setField(fee: FeeLineItem, field: keyof FeeLineItem, value: any) {
  emit('update:modelValue', props.modelValue.map(f => f.id === fee.id ? { ...f, [field]: value } : f))
}
</script>
