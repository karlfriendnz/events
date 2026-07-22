<template>
  <div class="px-4 sm:px-6 pt-7 pb-5">
    <div class="grid gap-3" :class="mobile ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'">
      <!-- When (date + time as one fact) → Cost → Location. -->
      <div v-if="(design.icons?.date || design.icons?.time) && (!live || event?.start_at)" class="flex items-start gap-2">
        <i class="pi pi-calendar text-gray-400 text-sm mt-0.5 shrink-0" />
        <div class="text-sm">
          <p class="font-semibold text-gray-600">When:</p>
          <p class="text-gray-500">{{ whenLabel }}</p>
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
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  design: { icons?: { date?: boolean; time?: boolean; cost?: boolean; location?: boolean; criteria?: boolean } }
  event: { start_at?: string | null; is_paid?: boolean; location?: string | null; criteria?: string | null } | null
  /** When true (phone preview), stack each detail full-width. */
  mobile?: boolean
  /** Live form (not the builder preview): show real values, suppress demo placeholders. */
  live?: boolean
  /** Real cost label for the live form. */
  cost?: string
}>()

// Date + time in one line — only the parts whose icon is enabled, joined by a dot.
const whenLabel = computed(() => {
  const at = props.event?.start_at
  if (!at) return props.live ? '' : 'Your event date'
  const d = new Date(at)
  const parts: string[] = []
  if (props.design?.icons?.date) parts.push(d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }))
  if (props.design?.icons?.time) parts.push(d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true }))
  return parts.join(' · ')
})
</script>
