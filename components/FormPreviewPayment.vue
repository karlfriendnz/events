<template>
  <div v-if="payment.plan.enabled || payment.credit_card.enabled || payment.invoice.enabled || payment.coupon.enabled"
    class="px-6 pb-6 space-y-2">
    <h3 class="text-sm font-bold text-gray-800 mb-3">Payment</h3>
    <FormsPaymentOptionCard v-if="payment.plan.enabled"
      icon="pi-calendar" title="Payment Plan"
      :selected="selected === 'plan'"
      @click="$emit('update:selected', 'plan')" />
    <FormsPaymentOptionCard v-if="payment.credit_card.enabled"
      icon="pi-credit-card" title="Pay by Credit Card"
      :selected="selected === 'credit_card'"
      @click="$emit('update:selected', 'credit_card')" />
    <FormsPaymentOptionCard v-if="payment.invoice.enabled"
      icon="pi-file-edit" title="Pay by Invoice"
      :selected="selected === 'invoice'"
      @click="$emit('update:selected', 'invoice')" />
    <FormsPaymentOptionCard v-if="payment.coupon.enabled"
      icon="pi-tag"
      :title="`Pay by Coupon (${payment.coupon.quantity} coupon${payment.coupon.quantity !== 1 ? 's' : ''} required)`"
      :selected="selected === 'coupon'"
      @click="$emit('update:selected', 'coupon')" />
  </div>
</template>

<script setup lang="ts">
type PaymentMethod = 'plan' | 'credit_card' | 'invoice' | 'coupon'

defineProps<{
  payment: {
    plan: { enabled: boolean }
    credit_card: { enabled: boolean }
    invoice: { enabled: boolean }
    coupon: { enabled: boolean; quantity: number }
  }
  selected: PaymentMethod | null
}>()
defineEmits<{ (e: 'update:selected', v: PaymentMethod | null): void }>()
</script>
