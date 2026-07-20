<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const props = defineProps<{ eventId: string; clubOrgId?: string | null }>()

const eventsApi = useEventsApi()
const toast = useToast()

// ── Communications (the send log) ──
const communications = ref<any[]>([])
const sentCommunications = computed(() => communications.value.filter(c => c.sent_at && !c.scheduled_at))
const scheduledCommunications = computed(() => communications.value.filter(c => c.scheduled_at && !c.sent_at))
const commsLoading = ref(false)

// ── Send composer ──
const showSendComms = ref(false)
const sendingComms = ref(false)
const newComms = ref({ channel: 'EMAIL', audience: 'ALL', subject: '', body: '' })
const audienceOptions = [
  { label: 'All invitees', value: 'ALL' },
  { label: 'Confirmed only', value: 'CONFIRMED' },
  { label: 'Invited (not confirmed)', value: 'INVITED' },
]

// Invitees are loaded so the composer can size the audience (recipient count).
// clubOrgId scopes to one club's own invitees on a shared event.
const invitees = ref<any[]>([])

function formatDateTime(d: string) {
  return new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

async function loadComms() {
  commsLoading.value = true
  // Event send-log via the events seam. Map camelCase → the snake shape the tab reads;
  // the MySQL communications table has no channel/scheduled_at columns (demo-only UI
  // fields), so real sent rows carry neither.
  const rows = (await eventsApi.communications(props.eventId)).map(c => ({
    id: c.id, subject: c.subject, body: c.body,
    recipient_count: c.recipientCount, sent_at: c.sentAt, channel: null, scheduled_at: null,
  }))
  if (rows.length) {
    communications.value = rows
  } else {
    // Demo data
    communications.value = [
      { id: 'demo-1', channel: 'EMAIL',   subject: 'Invitation',        body: 'A special email list to send to our alumni', recipient_count: 25, sent_at: '2025-01-10T12:32:00Z', scheduled_at: null },
      { id: 'demo-2', channel: 'APP',     subject: 'Event Reminder',    body: 'Don\'t forget your event is coming up this weekend.', recipient_count: 25, sent_at: '2025-01-12T09:00:00Z', scheduled_at: null },
      { id: 'demo-3', channel: 'EMAIL',   subject: 'Last Chance to Register', body: 'Registrations close tomorrow — make sure you\'ve signed up.', recipient_count: 40, sent_at: '2025-01-14T08:00:00Z', scheduled_at: null },
      { id: 'demo-4', channel: 'APP',     subject: 'Invitation',        body: 'A special email list to send to our alumni', recipient_count: 25, sent_at: null, scheduled_at: '2025-01-20T12:32:00Z', schedule_label: '3 hours before event' },
      { id: 'demo-5', channel: 'EMAIL',   subject: 'Post-Event Survey', body: 'We\'d love your feedback on the event.', recipient_count: 25, sent_at: null, scheduled_at: '2025-01-22T18:00:00Z', schedule_label: '1 day after event' },
    ]
  }
  // Load invitees (scoped to this club on shared events) so the composer can size the audience.
  try {
    invitees.value = await eventsApi.invitees(props.eventId, props.clubOrgId ?? null)
  } catch {
    invitees.value = []
  }
  commsLoading.value = false
}

async function handleSendComms() {
  if (!newComms.value.subject || !newComms.value.body) return
  sendingComms.value = true
  const audienceCount = newComms.value.audience === 'ALL'
    ? invitees.value.length
    : invitees.value.filter(i => i.status === newComms.value.audience).length
  // Record the send via the events seam (honest row: real recipientCount, status SENT).
  // The channel is captured in the audienceFilter blob — the log table has no channel
  // column of its own.
  try {
    await eventsApi.sendCommunication(props.eventId, {
      subject: newComms.value.subject, body: newComms.value.body,
      recipientCount: audienceCount,
      audienceFilter: { channel: newComms.value.channel, audience: newComms.value.audience },
    })
    toast.add({ severity: 'success', summary: 'Message sent', life: 3000 })
    showSendComms.value = false
    newComms.value = { channel: 'EMAIL', audience: 'ALL', subject: '', body: '' }
    loadComms()
  } catch {
    // leave the composer open on failure
  }
  sendingComms.value = false
}

onMounted(loadComms)
watch(() => props.eventId, loadComms)
</script>

<template>
  <div>

    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h2 class="text-lg font-bold text-gray-900">Send and Schedule Communication</h2>
        <p class="text-sm text-gray-500 mt-0.5">Below are a list of all communications that have been sent to your invitees</p>
      </div>
      <div class="flex flex-wrap items-center gap-2 shrink-0">
        <Button label="Create email" icon="pi pi-envelope" size="small" severity="secondary" outlined @click="showSendComms = true" />
        <Button label="Send App notifications" icon="pi pi-send" size="small" @click="showSendComms = true" style="background:#34B66D; border-color:#34B66D" />
      </div>
    </div>

    <div v-if="commsLoading" class="py-8 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>

    <template v-else>
      <!-- Sent Communications -->
      <div class="mt-8">
        <h3 class="text-sm font-bold text-gray-800 mb-3">Sent Communication</h3>
        <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-32">Type</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-48">Subject</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-28">
                  <span class="flex items-center gap-1.5"><i class="pi pi-users text-gray-400" /> Recipients</span>
                </th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600">Description</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-44">
                  <span class="flex items-center gap-1.5"><i class="pi pi-calendar text-gray-400" /> Sent</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="!sentCommunications.length">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">No messages sent yet</td>
              </tr>
              <tr v-for="c in sentCommunications" :key="c.id" class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                  <span class="text-sm text-primary font-medium cursor-pointer hover:underline">{{ c.channel === 'EMAIL' ? 'Email' : 'App message' }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-primary cursor-pointer hover:underline">{{ c.subject }}</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">{{ c.recipient_count ?? '—' }}</td>
                <td class="px-4 py-3 text-sm text-gray-600">{{ c.body ? c.body.slice(0, 80) + (c.body.length > 80 ? '…' : '') : '—' }}</td>
                <td class="px-4 py-3 text-sm text-gray-600">{{ formatDateTime(c.sent_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Scheduled Communications -->
      <div class="mt-8">
        <h3 class="text-sm font-bold text-gray-800 mb-3">Scheduled Communication</h3>
        <div class="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 bg-gray-50">
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-32">Type</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-48">Subject</th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-28">
                  <span class="flex items-center gap-1.5"><i class="pi pi-users text-gray-400" /> Recipients</span>
                </th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-44">
                  <span class="flex items-center gap-1.5"><i class="pi pi-calendar text-gray-400" /> Scheduled</span>
                </th>
                <th class="text-left px-4 py-3 text-xs font-semibold text-gray-600 w-44">
                  <span class="flex items-center gap-1.5"><i class="pi pi-calendar text-gray-400" /> Date / Time</span>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-if="!scheduledCommunications.length">
                <td colspan="5" class="px-4 py-8 text-center text-sm text-gray-400">No scheduled messages</td>
              </tr>
              <tr v-for="c in scheduledCommunications" :key="c.id" class="hover:bg-gray-50 transition-colors">
                <td class="px-4 py-3">
                  <span class="text-sm text-primary font-medium cursor-pointer hover:underline">{{ c.channel === 'EMAIL' ? 'Email' : 'App message' }}</span>
                </td>
                <td class="px-4 py-3">
                  <span class="text-sm text-primary cursor-pointer hover:underline">{{ c.subject }}</span>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700">{{ c.recipient_count ?? '—' }}</td>
                <td class="px-4 py-3 text-sm text-gray-600">{{ c.schedule_label ?? '—' }}</td>
                <td class="px-4 py-3 text-sm text-gray-600">{{ formatDateTime(c.scheduled_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Send message dialog -->
    <Dialog v-model:visible="showSendComms" header="Send Message" modal :style="{ width: '95vw', maxWidth: '560px' }">
      <div class="flex flex-col gap-4 py-2">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Channel</label>
            <Select v-model="newComms.channel" :options="[{ label: 'Email', value: 'EMAIL' }, { label: 'SMS', value: 'SMS' }]" option-label="label" option-value="value" class="w-full" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium">Send to</label>
            <Select v-model="newComms.audience" :options="audienceOptions" option-label="label" option-value="value" class="w-full" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Subject</label>
          <InputText v-model="newComms.subject" placeholder="Message subject" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Message</label>
          <Textarea v-model="newComms.body" rows="5" placeholder="Write your message…" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showSendComms = false" />
        <Button label="Send" :loading="sendingComms" :disabled="!newComms.subject || !newComms.body" @click="handleSendComms" style="background:var(--brand-primary); border-color:var(--brand-primary)" />
      </template>
    </Dialog>

  </div>
</template>
