<template>
  <div class="space-y-2">
    <div v-for="m in methods" :key="m.value" class="bg-white rounded-xl border border-gray-200">
      <div class="flex items-center gap-3 px-4 py-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          :class="enabled(m.value) ? 'bg-primary/10' : 'bg-gray-100'">
          <i :class="`pi ${m.icon} text-sm`" :style="enabled(m.value) ? 'color:var(--brand-primary)' : 'color:#6b7280'" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-gray-800">
            Enable pay by <span class="font-semibold">{{ m.label }}</span>
          </p>
          <div v-if="enabled(m.value) && defaultModel === m.value" class="mt-1">
            <span class="inline-block text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
              Default
            </span>
          </div>
          <button v-else-if="enabled(m.value) && allowDefault"
            type="button"
            class="text-[11px] text-gray-400 hover:text-primary mt-0.5 transition-colors"
            @click="$emit('update:defaultModel', m.value)">
            Set as default
          </button>
        </div>
        <ToggleSwitch :modelValue="enabled(m.value)"
          @update:modelValue="setEnabled(m.value, $event)" />
      </div>

      <!-- Sub-controls when Invoice is enabled -->
      <div v-if="m.value === 'invoice' && enabled('invoice')" class="px-4 pb-3 -mt-1">
        <label class="text-xs font-medium text-gray-600 block mb-1.5">Choose bank account</label>
        <div class="flex items-center gap-2">
          <Select
            :modelValue="bankAccountId"
            @update:modelValue="$emit('update:bankAccountId', $event)"
            :options="bankAccountOptions"
            option-label="label" option-value="value"
            :placeholder="bankAccountOptions.length ? 'Choose…' : 'No bank accounts yet'"
            :disabled="!bankAccountOptions.length"
            show-clear class="flex-1" />
          <Button v-if="manageBankAccounts" label="Manage" icon="pi pi-cog" size="small" severity="secondary" outlined
            @click="$emit('manage-bank-accounts')" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: Record<string, boolean>
  defaultModel?: string | null
  bankAccounts?: { id: string; name: string; details?: string | null }[]
  bankAccountId?: string | null
  allowDefault?: boolean
  manageBankAccounts?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: Record<string, boolean>): void
  (e: 'update:defaultModel', v: string | null): void
  (e: 'update:bankAccountId', v: string | null): void
  (e: 'manage-bank-accounts'): void
}>()

const methods = [
  { value: 'invoice',      label: 'Invoice',      icon: 'pi-file' },
  { value: 'credit_card',  label: 'Credit Card',  icon: 'pi-credit-card' },
  { value: 'payment_plan', label: 'Payment Plan', icon: 'pi-calendar' },
  { value: 'coupon',       label: 'Coupon',       icon: 'pi-tag' },
]

const bankAccountOptions = computed(() =>
  (props.bankAccounts ?? []).map(b => ({ value: b.id, label: b.name + (b.details ? ` — ${b.details}` : '') })),
)

function enabled(key: string) { return !!props.modelValue?.[key] }
function setEnabled(key: string, value: boolean) {
  const next = { ...(props.modelValue ?? {}), [key]: value }
  emit('update:modelValue', next)
  if (!value && props.defaultModel === key) emit('update:defaultModel', null)
  if (value && props.allowDefault && !props.defaultModel) {
    const enabledCount = Object.entries(next).filter(([_k, v]) => v).length
    if (enabledCount === 1) emit('update:defaultModel', key)
  }
}
</script>
