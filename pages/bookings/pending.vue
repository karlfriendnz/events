<template>
  <div class="p-3 sm:p-6 max-w-6xl mx-auto">
    <div class="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Pending bookings</h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Bookings waiting on your approval. Approve to confirm the slot, decline to free it up.
        </p>
      </div>
      <span v-if="rows.length"
        class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
        <i class="pi pi-clock text-[10px]" />
        {{ rows.length }} awaiting approval
      </span>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-24 text-gray-400">
      <i class="pi pi-spin pi-spinner text-2xl" />
    </div>

    <div v-else-if="!rows.length"
      class="border-2 border-dashed border-gray-200 rounded-xl py-20 text-center bg-white">
      <div class="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-3">
        <i class="pi pi-check-circle text-2xl text-green-500" />
      </div>
      <p class="text-base font-semibold text-gray-700">All caught up!</p>
      <p class="text-sm text-gray-400 mt-1">No bookings are waiting for your approval right now.</p>
    </div>

    <div v-else class="space-y-2">
      <div v-for="b in rows" :key="b.id"
        class="bg-white rounded-xl border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
        @click="openBooking(b)">
        <div class="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4">

          <!-- Activity colour swatch -->
          <div class="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
            :style="{ background: (b.activity_mode?.color || '#1E2157') + '20' }">
            <i class="pi pi-clock text-base" :style="{ color: b.activity_mode?.color || '#1E2157' }" />
          </div>

          <!-- Body -->
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <p class="text-sm font-semibold text-gray-900 truncate">{{ b.contact_name || 'Unnamed booker' }}</p>
              <p v-if="b.contact_email" class="text-xs text-gray-400 truncate">{{ b.contact_email }}</p>
            </div>
            <div class="flex items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap">
              <span class="flex items-center gap-1.5">
                <i class="pi pi-calendar text-[10px] text-gray-300" />
                {{ formatWhen(b.start_at, b.end_at) }}
              </span>
              <span v-if="b.bookable" class="flex items-center gap-1.5">
                <i class="pi pi-building text-[10px] text-gray-300" />
                {{ b.bookable.name }}
              </span>
              <span v-if="b.activity_mode" class="flex items-center gap-1.5">
                <i class="pi pi-sliders-h text-[10px] text-gray-300" />
                {{ b.activity?.name || '' }}<template v-if="b.activity_mode.name"> — {{ b.activity_mode.name }}</template>
              </span>
              <span v-if="b.attendee_count" class="flex items-center gap-1.5">
                <i class="pi pi-users text-[10px] text-gray-300" />
                {{ b.attendee_count }} {{ b.attendee_count === 1 ? 'person' : 'people' }}
              </span>
              <span v-if="paymentLabel(b)" class="flex items-center gap-1.5">
                <i class="pi pi-credit-card text-[10px] text-gray-300" />
                {{ paymentLabel(b) }}
              </span>
            </div>
            <p v-if="b.notes" class="text-xs text-gray-500 mt-1.5 italic line-clamp-2">"{{ b.notes }}"</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end" @click.stop>
            <Button label="Decline" icon="pi pi-times" size="small" severity="danger" outlined
              :loading="busyId === b.id" @click="decline(b)" />
            <Button label="Approve" icon="pi pi-check" size="small"
              :loading="busyId === b.id" @click="approve(b)"
              style="background:#10b981;border-color:#10b981" />
          </div>
        </div>
      </div>
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

definePageMeta({ layout: 'default' })

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

useBreadcrumbs([{ label: 'Bookings' }, { label: 'Pending' }])

const rows = ref<any[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)

const PAYMENT_LABELS: Record<string, string> = {
  invoice: 'Invoice',
  credit_card: 'Credit Card',
  payment_plan: 'Payment Plan',
  coupon: 'Coupon',
  card: 'Credit / Debit Card',
  bank: 'Bank Transfer',
  cash: 'Cash on the Day',
}
function paymentLabel(b: any): string | null {
  const k = b?.custom_fields?._payment_method
  return k ? (PAYMENT_LABELS[k] ?? k) : null
}

function formatWhen(startIso: string, endIso: string): string {
  if (!startIso) return ''
  const s = new Date(startIso)
  const e = endIso ? new Date(endIso) : null
  const sameDay = e && s.toDateString() === e.toDateString()
  const datePart = s.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const startTime = s.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  if (!e) return `${datePart} · ${startTime}`
  const endTime = e.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `${datePart} · ${startTime} – ${endTime}`
  return `${datePart} ${startTime} → ${e.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} ${endTime}`
}

async function load() {
  if (!orgId.value) return
  loading.value = true
  // bookings has no org_id — scope through the bookable.
  const { data } = await (db.from as any)('bookings')
    .select(`
      id, status, start_at, end_at, contact_name, contact_email, contact_phone, attendee_count,
      notes, custom_fields, bookable_id, created_at,
      bookable:bookables!inner(id, name, location, org_id),
      activity:activities(name),
      activity_mode:activity_modes(id, name, color)
    `)
    .eq('bookable.org_id', orgId.value)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
  rows.value = data ?? []
  loading.value = false
}

// Clicking a row navigates to the venue page with the booking modal pre-opened
// (same modal as the calendar). Approve / Decline buttons keep working inline.
function openBooking(b: any) {
  navigateTo(`/bookables/${b.bookable_id}?tab=bookings&booking=${b.id}`)
}

async function approve(b: any) {
  busyId.value = b.id
  try {
    await (db.from as any)('bookings').update({ status: 'CONFIRMED' }).eq('id', b.id)
    await (db.from as any)('notifications').insert({
      org_id: orgId.value,
      type: 'booking.approved',
      title: 'Booking approved',
      body: `${b.contact_name || 'Booking'} — ${formatWhen(b.start_at, b.end_at)}`,
      link: `/bookables/${b.bookable_id}?tab=bookings`,
      payload: { booking_id: b.id },
    }).select('id').single().then(({ data: n }: any) => {
      if (n?.id) $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: n.id } }).catch(() => {})
    })
    $fetch('/api/send-customer-booking-email', { method: 'POST', body: { bookingId: b.id, event: 'approved' } }).catch(() => {})
    rows.value = rows.value.filter(r => r.id !== b.id)
    toast.add({ severity: 'success', summary: 'Booking approved', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not approve', detail: e?.message, life: 4000 })
  }
  busyId.value = null
}

async function decline(b: any) {
  if (!confirm(`Decline ${b.contact_name || 'this booking'}? The slot will be freed up.`)) return
  busyId.value = b.id
  try {
    await (db.from as any)('bookings').update({ status: 'CANCELLED' }).eq('id', b.id)
    await (db.from as any)('notifications').insert({
      org_id: orgId.value,
      type: 'booking.declined',
      title: 'Booking declined',
      body: `${b.contact_name || 'Booking'} — ${formatWhen(b.start_at, b.end_at)}`,
      link: `/bookables/${b.bookable_id}?tab=bookings`,
      payload: { booking_id: b.id },
    }).select('id').single().then(({ data: n }: any) => {
      if (n?.id) $fetch('/api/send-notification-email', { method: 'POST', body: { notificationId: n.id } }).catch(() => {})
    })
    $fetch('/api/send-customer-booking-email', { method: 'POST', body: { bookingId: b.id, event: 'declined' } }).catch(() => {})
    rows.value = rows.value.filter(r => r.id !== b.id)
    toast.add({ severity: 'success', summary: 'Booking declined', life: 2500 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not decline', detail: e?.message, life: 4000 })
  }
  busyId.value = null
}

watch(orgId, load, { immediate: true })
</script>
