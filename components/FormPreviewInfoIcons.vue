<template>
  <div class="px-4 sm:px-6 pt-7 pb-5">
    <div class="grid gap-3" :class="mobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'">
      <div v-if="design.icons?.date && (!live || event?.start_at)" class="flex items-start gap-2">
        <i class="pi pi-calendar text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Date:</p>
          <p class="text-gray-500">{{ event?.start_at ? new Date(event.start_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Your event date' }}</p>
        </div>
      </div>
      <div v-if="design.icons?.time && (!live || event?.start_at)" class="flex items-start gap-2">
        <i class="pi pi-clock text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Time:</p>
          <p class="text-gray-500">{{ event?.start_at ? new Date(event.start_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Your event time' }}</p>
        </div>
      </div>
      <div v-if="design.icons?.cost" class="flex items-start gap-2">
        <i class="pi pi-dollar text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Cost:</p>
          <!-- A real cost wins wherever it's known — the builder used to say "Set by
               your fees" even once the fees were set. -->
          <p class="text-gray-500">{{ cost || (live ? 'Free' : (event?.is_paid ? 'Paid' : 'Set by your fees')) }}</p>
        </div>
      </div>
      <div v-if="design.icons?.location && (!live || event?.location)" class="flex items-start gap-2">
        <i class="pi pi-map-marker text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Location:</p>
          <p class="text-gray-500">{{ event?.location || (live ? '' : 'Your event venue') }}</p>
        </div>
      </div>
      <!-- Criteria copy is illustrative on the builder preview; hidden on the live form unless a real value is supplied. -->
      <div v-if="design.icons?.criteria && (!live || event?.criteria)" class="flex items-start gap-2">
        <i class="pi pi-user text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">Invitee Restrictions:</p>
          <p class="text-gray-500">{{ event?.criteria || 'Any age' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  design: { icons?: { date?: boolean; time?: boolean; cost?: boolean; location?: boolean; criteria?: boolean } }
  event: { start_at?: string | null; is_paid?: boolean; location?: string | null; criteria?: string | null } | null
  /** When true (phone preview), stack each detail full-width. */
  mobile?: boolean
  /** Live form (not the builder preview): show real values, suppress demo placeholders. */
  live?: boolean
  /** Real cost label for the live form. */
  cost?: string
}>()
</script>
