<template>
  <div class="px-6 pt-7 pb-5">
    <div class="grid grid-cols-3 gap-3">
      <div v-if="design.icons?.date" class="flex items-start gap-2">
        <i class="pi pi-calendar text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Date:</p>
          <p class="text-gray-500">{{ event?.start_at ? new Date(event.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '19th July 2025' }}</p>
        </div>
      </div>
      <div v-if="design.icons?.time" class="flex items-start gap-2">
        <i class="pi pi-clock text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Time:</p>
          <p class="text-gray-500">{{ event?.start_at ? new Date(event.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) : '1:34 pm' }}</p>
        </div>
      </div>
      <div v-if="design.icons?.cost" class="flex items-start gap-2">
        <i class="pi pi-dollar text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Cost:</p>
          <p class="text-gray-500">{{ event?.is_paid ? 'Paid' : '$25.00' }}</p>
        </div>
      </div>
      <div v-if="design.icons?.location" class="flex items-start gap-2">
        <i class="pi pi-map-marker text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Location:</p>
          <p class="text-gray-500">{{ event?.location || 'Bay park › Conference room 1' }}</p>
        </div>
      </div>
      <div v-if="design.icons?.criteria" class="flex items-start gap-2">
        <i class="pi pi-user text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Invitee Restrictions:</p>
          <p class="text-gray-500">18+ invite</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  design: { icons?: { date?: boolean; time?: boolean; cost?: boolean; location?: boolean; criteria?: boolean } }
  event: { start_at?: string | null; is_paid?: boolean; location?: string | null } | null
}>()
</script>
