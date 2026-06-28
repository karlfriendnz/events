<template>
  <div :class="flush ? '' : 'rounded-xl border border-gray-200 overflow-hidden bg-white'">

    <!-- Mobile: one stacked card per fee -->
    <div class="md:hidden divide-y divide-gray-100">
      <div v-for="fee in modelValue" :key="fee.id" class="p-3 space-y-2">
        <textarea
          :value="fee.name" rows="1" placeholder="Fee name"
          class="w-full px-3 py-2 text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-lg outline-none focus:border-primary resize-none leading-5"
          @input="(e) => { setField(fee, 'name', (e.target as HTMLTextAreaElement).value); autoGrow(e.target as HTMLTextAreaElement) }"
          @keydown.enter.exact.prevent
          @focus="(e) => autoGrow(e.target as HTMLTextAreaElement)" />
        <div class="flex items-center gap-2">
          <input
            :value="fee.xero_code" type="text" placeholder="Account code"
            class="flex-1 min-w-0 h-9 px-3 text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-lg outline-none focus:border-primary"
            @input="setField(fee, 'xero_code', ($event.target as HTMLInputElement).value)" />
          <div class="flex items-center gap-1 h-9 px-2 border border-gray-200 rounded-lg focus-within:border-primary w-28 shrink-0">
            <span class="text-gray-400 shrink-0 text-sm">$</span>
            <input
              :value="amountDisplay[fee.id] ?? (fee.amount != null ? fee.amount.toFixed(2) : '')"
              type="text" inputmode="decimal" placeholder="0.00"
              class="flex-1 min-w-0 text-right text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              @input="(e) => {
                const raw = (e.target as HTMLInputElement).value
                amountDisplay[fee.id] = raw
                const v = parseFloat(raw)
                if (!isNaN(v)) setField(fee, 'amount', Math.round(v * 100) / 100)
              }"
              @blur="(e) => {
                const v = parseFloat((e.target as HTMLInputElement).value)
                const val = isNaN(v) ? null : Math.round(v * 100) / 100
                setField(fee, 'amount', val)
                amountDisplay[fee.id] = val != null ? val.toFixed(2) : ''
              }" />
          </div>
          <button type="button" class="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-red-500 shrink-0" @click="removeFee(fee)">
            <i class="pi pi-trash text-xs" />
          </button>
        </div>
      </div>
      <div class="flex items-center justify-between px-3 py-2.5 bg-gray-50 text-sm font-semibold text-gray-800">
        <span>Total</span><span>${{ total }}</span>
      </div>
    </div>

    <!-- Desktop: table -->
    <div class="hidden md:block">
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
            <div class="relative flex items-start">
              <textarea
                :ref="el => nameInputs[fee.id] = el as HTMLTextAreaElement"
                :value="fee.name"
                rows="1"
                placeholder="Enter fee name"
                class="w-full min-h-10 px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 bg-transparent border-0 outline-none focus:bg-blue-50/40 transition-colors resize-none leading-5 overflow-hidden"
                @input="(e) => { setField(fee, 'name', (e.target as HTMLTextAreaElement).value); autoGrow(e.target as HTMLTextAreaElement) }"
                @keydown.enter.exact.prevent
                @focus="(e) => autoGrow(e.target as HTMLTextAreaElement)" />
              <!-- Token insert button -->
              <button
                v-if="tokens?.length"
                type="button"
                tabindex="-1"
                data-token-btn
                class="shrink-0 mr-1 w-6 h-6 flex items-center justify-center rounded transition-colors"
                :class="activeTokenMenu === fee.id ? 'text-primary bg-gray-100' : 'text-gray-300 hover:text-primary hover:bg-gray-100'"
                @mousedown.prevent
                @click="toggleTokenMenu(fee, $event.currentTarget as HTMLElement)">
                <span class="text-[10px] font-bold font-mono">{·}</span>
              </button>
            </div>
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
                :value="amountDisplay[fee.id] ?? (fee.amount != null ? fee.amount.toFixed(2) : '')"
                type="text"
                inputmode="decimal"
                placeholder="0.00"
                class="flex-1 min-w-0 text-right text-sm text-gray-800 placeholder-gray-400 bg-transparent border-0 outline-none"
                @input="(e) => {
                  const raw = (e.target as HTMLInputElement).value
                  amountDisplay[fee.id] = raw
                  const v = parseFloat(raw)
                  if (!isNaN(v)) setField(fee, 'amount', Math.round(v * 100) / 100)
                }"
                @blur="(e) => {
                  const v = parseFloat((e.target as HTMLInputElement).value)
                  const val = isNaN(v) ? null : Math.round(v * 100) / 100
                  setField(fee, 'amount', val)
                  amountDisplay[fee.id] = val != null ? val.toFixed(2) : ''
                }" />
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
    </div>

    <!-- Add fee -->
    <div class="px-4 py-2.5 border-t border-gray-100">
      <button
        type="button"
        class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-primary transition-colors"
        @click="addFee">
        <i class="pi pi-plus text-xs" />
        <span>Add Fee</span>
      </button>
    </div>
  </div>

  <!-- Token menu — teleported to body to escape overflow:hidden -->
  <Teleport to="body">
    <div
      v-if="activeTokenMenu && tokens?.length"
      data-token-btn
      class="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
      :style="{ top: menuPos.top + 'px', right: menuPos.right + 'px' }">
      <button
        v-for="token in tokens"
        :key="token.value"
        type="button"
        class="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 transition-colors"
        @mousedown.prevent
        @click="insertToken(token.value)">
        <code class="text-primary bg-blue-50 px-1 py-0.5 rounded text-[10px]">{{ token.value }}</code>
        <span class="text-gray-500">{{ token.label }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Sortable from 'sortablejs'
import type { FeeLineItem } from '~/composables/useFeeGroups'
import { feeTotal } from '~/composables/useFeeGroups'

export interface FeeToken {
  label: string
  value: string
}

const props = defineProps<{
  modelValue: FeeLineItem[]
  tokens?: FeeToken[]
  flush?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [FeeLineItem[]]
}>()

const total = computed(() => feeTotal(props.modelValue))
const tbodyEl = ref<HTMLElement | null>(null)
const amountDisplay = reactive<Record<string, string>>({})
const activeTokenMenu = ref<string | null>(null)
const nameInputs = reactive<Record<string, HTMLTextAreaElement>>({})

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}
const menuPos = reactive({ top: 0, right: 0 })

function toggleTokenMenu(fee: FeeLineItem, btn: HTMLElement) {
  if (activeTokenMenu.value === fee.id) {
    activeTokenMenu.value = null
    return
  }
  const rect = btn.getBoundingClientRect()
  menuPos.top = rect.bottom + 4
  menuPos.right = window.innerWidth - rect.right
  activeTokenMenu.value = fee.id
}

function closeOnOutsideClick(e: MouseEvent) {
  if (activeTokenMenu.value && !(e.target as HTMLElement).closest?.('[data-token-btn]')) {
    activeTokenMenu.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', closeOnOutsideClick)

  if (!props.modelValue.length) addFee()

  nextTick(() => {
    for (const el of Object.values(nameInputs)) if (el) autoGrow(el)
  })

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

onUnmounted(() => {
  document.removeEventListener('click', closeOnOutsideClick)
})

function insertToken(token: string) {
  const feeId = activeTokenMenu.value
  if (!feeId) return
  const fee = props.modelValue.find(f => f.id === feeId)
  if (!fee) return
  const input = nameInputs[feeId]
  const start = input?.selectionStart ?? fee.name.length
  const end = input?.selectionEnd ?? fee.name.length
  const newName = fee.name.slice(0, start) + token + fee.name.slice(end)
  setField(fee, 'name', newName)
  activeTokenMenu.value = null
  nextTick(() => {
    if (input) {
      input.focus()
      const pos = start + token.length
      input.setSelectionRange(pos, pos)
      autoGrow(input)
    }
  })
}

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
