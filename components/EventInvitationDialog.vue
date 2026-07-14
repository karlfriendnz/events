<!--
  Send the invitation email for an event.

  BASIC ON PURPOSE — subject + message + merge fields. The club's real mailer is
  the (upgraded) FriendlyManager one; this is the starting point that sends a
  decent email today without pre-empting it. The branded header, the event card
  and the buttons are assembled server-side (server/utils/email.ts), so the club
  writes the MESSAGE, not the layout.

  Wording resolves: this event's own → the club's default (Settings → Communications)
  → the built-in DEFAULT_INVITATION. Saving here saves THIS event's wording;
  "Save as club default" writes it back to email_templates for every future event.
-->
<script setup lang="ts">
import { EVENT_TOKENS, DEFAULT_INVITATION, substituteEventTokens } from '~/composables/useEventTokens'

const props = defineProps<{ eventId: string }>()
const visible = defineModel<boolean>('visible', { default: false })

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()

const loading = ref(true)
const sending = ref(false)
const subject = ref('')
const body = ref('')
const bodyEl = ref<any>(null)

const evt = ref<any>(null)
const org = ref<any>(null)
const stats = ref({ total: 0, withEmail: 0, alreadySent: 0 })
const resend = ref(false)

// Who this send will actually reach — the number that matters, and the one the
// old comms tab only ever guessed at.
const willReceive = computed(() =>
  resend.value ? stats.value.withEmail : stats.value.withEmail - stats.value.alreadySent)
const noEmail = computed(() => stats.value.total - stats.value.withEmail)

// A form event asks people to REGISTER; otherwise it asks them to reply yes/no.
// The email follows the event — we never ask for an RSVP to a form event.
const wantsForm = computed(() => !!evt.value?.form_id)

async function load() {
  loading.value = true
  const [{ data: e }, { data: o }, { data: tpl }, { data: invs }] = await Promise.all([
    (db.from as any)('events').select('id, title, start_at, form_id, invitation_email').eq('id', props.eventId).maybeSingle(),
    (db.from as any)('organisations').select('name').eq('id', orgId.value).maybeSingle(),
    (db.from as any)('email_templates').select('subject, body').eq('org_id', orgId.value).eq('key', 'event_invitation').maybeSingle(),
    (db.from as any)('invitees').select('invite_sent_at, persons(email)').eq('event_id', props.eventId),
  ])
  evt.value = e
  org.value = o

  const list = invs ?? []
  stats.value = {
    total: list.length,
    withEmail: list.filter((i: any) => i.persons?.email).length,
    alreadySent: list.filter((i: any) => i.persons?.email && i.invite_sent_at).length,
  }

  // This event's wording → the club's default → the built-in one.
  const own = (e?.invitation_email ?? {}) as { subject?: string; body?: string }
  subject.value = own.subject ?? tpl?.subject ?? DEFAULT_INVITATION.subject
  body.value = own.body ?? tpl?.body ?? DEFAULT_INVITATION.body
  loading.value = false
}

// Insert a merge field where the cursor is, not blindly at the end.
function insertToken(token: string) {
  const el = bodyEl.value?.$el ?? bodyEl.value
  const start = el?.selectionStart ?? body.value.length
  const end = el?.selectionEnd ?? body.value.length
  body.value = body.value.slice(0, start) + token + body.value.slice(end)
  nextTick(() => {
    el?.focus?.()
    el?.setSelectionRange?.(start + token.length, start + token.length)
  })
}

// What the recipient will actually read — tokens filled in with real values.
const preview = computed(() => {
  const ctx = {
    firstName: 'Sam', lastName: 'Smith',
    eventTitle: evt.value?.title ?? '', startAt: evt.value?.start_at ?? null,
    venueName: 'the club', clubName: org.value?.name ?? '',
  }
  return {
    subject: substituteEventTokens(subject.value, ctx),
    body: substituteEventTokens(body.value, ctx),
  }
})

async function saveWording() {
  await (db.from as any)('events')
    .update({ invitation_email: { subject: subject.value, body: body.value } })
    .eq('id', props.eventId)
}

async function saveAsClubDefault() {
  await (db.from as any)('email_templates').upsert({
    org_id: orgId.value, key: 'event_invitation',
    subject: subject.value, body: body.value, updated_at: new Date().toISOString(),
  }, { onConflict: 'org_id,key' })
  toast.add({ severity: 'success', summary: 'Saved as your club default', life: 3000 })
}

async function send() {
  sending.value = true
  try {
    await saveWording()   // sending is also a decision to keep this wording
    const res: any = await $fetch('/api/send-event-invitations', {
      method: 'POST',
      body: { eventId: props.eventId, subject: subject.value, body: body.value, resend: resend.value },
    })
    if (res.sent) {
      toast.add({
        severity: 'success',
        summary: `Invitation sent to ${res.sent} ${res.sent === 1 ? 'person' : 'people'}`,
        detail: res.failed ? `${res.failed} failed to send.` : undefined,
        life: 4000,
      })
      visible.value = false
    } else {
      toast.add({
        severity: 'warn',
        summary: 'Nobody to send to',
        detail: res.failed ? (res.errors?.[0] ?? 'Every send failed.') : 'Everyone invited has already been sent this invitation.',
        life: 5000,
      })
    }
    await load()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not send', detail: e?.data?.message ?? 'Something went wrong.', life: 5000 })
  } finally {
    sending.value = false
  }
}

watch(visible, v => { if (v) load() })
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Send invitation" :style="{ width: '95vw', maxWidth: '760px' }">
    <div v-if="loading" class="py-10 text-center text-sm text-gray-400">
      <i class="pi pi-spin pi-spinner text-xl text-gray-300 block mb-2" />
      Loading…
    </div>

    <div v-else class="space-y-4">
      <!-- Who it's going to. Stated plainly, because "recipients" was a guess before. -->
      <div class="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <i class="pi pi-send text-gray-400 text-xs mt-0.5" />
        <div class="text-xs text-gray-600">
          <p class="text-sm font-medium text-gray-800">
            Sending to {{ willReceive }} {{ willReceive === 1 ? 'person' : 'people' }}
          </p>
          <p v-if="stats.alreadySent && !resend" class="mt-0.5">
            {{ stats.alreadySent }} already had this invitation and will be skipped.
          </p>
          <p v-if="noEmail" class="mt-0.5 text-amber-700">
            {{ noEmail }} {{ noEmail === 1 ? 'person has' : 'people have' }} no email address — they can't be emailed.
          </p>
        </div>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6">
        <label class="text-sm text-gray-500 w-full sm:w-28 shrink-0">Subject</label>
        <InputText v-model="subject" class="w-full" />
      </div>

      <div class="flex flex-col sm:flex-row gap-1 sm:gap-6">
        <label class="text-sm text-gray-500 w-full sm:w-28 shrink-0 sm:pt-2">Message</label>
        <div class="flex-1 min-w-0">
          <Textarea ref="bodyEl" v-model="body" rows="7" class="w-full" />
          <!-- Merge fields: click to drop one in at the cursor. -->
          <div class="flex flex-wrap items-center gap-1.5 mt-2">
            <span class="text-xs text-gray-400 mr-1">Add:</span>
            <button v-for="t in EVENT_TOKENS" :key="t.value" type="button"
              v-tooltip.top="t.hint"
              class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              @click="insertToken(t.value)">
              {{ t.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- What the email will ask them to do. Follows the event, not a choice here. -->
      <div class="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
        <i class="pi pi-info-circle text-blue-400 text-xs mt-0.5" />
        <p class="text-xs text-blue-900">
          <template v-if="wantsForm">
            This event has a registration form, so the email carries a <strong>Register</strong> button that opens it.
          </template>
          <template v-else>
            This event just needs a yes or no, so the email carries <strong>Yes, I'll be there</strong> and
            <strong>Can't make it</strong> buttons. One click, no login.
          </template>
          Your club's logo and colours are added automatically.
        </p>
      </div>

      <!-- Preview: the merge fields filled in, so nobody ships "Hi {first_name}," -->
      <details class="rounded-lg border border-gray-200 overflow-hidden">
        <summary class="px-4 py-2.5 text-sm text-gray-700 cursor-pointer select-none hover:bg-gray-50">
          Preview
        </summary>
        <div class="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <p class="text-xs text-gray-400 mb-1">Subject</p>
          <p class="text-sm text-gray-800 mb-3">{{ preview.subject }}</p>
          <p class="text-xs text-gray-400 mb-1">Message (as Sam Smith would see it)</p>
          <p class="text-sm text-gray-700 whitespace-pre-line">{{ preview.body }}</p>
        </div>
      </details>

      <div v-if="stats.alreadySent" class="flex items-center gap-2">
        <Checkbox v-model="resend" binary input-id="resend" />
        <label for="resend" class="text-sm text-gray-600">
          Send again to the {{ stats.alreadySent }} already invited
        </label>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
        <button type="button" class="text-xs text-gray-500 hover:text-primary hover:underline"
          @click="saveAsClubDefault">
          Save this wording as our club default
        </button>
        <div class="flex gap-2">
          <Button label="Cancel" severity="secondary" text @click="visible = false" />
          <Button :label="`Send to ${willReceive}`" icon="pi pi-send" :loading="sending"
            :disabled="!willReceive" style="background:#1E2157;border-color:#1E2157" @click="send" />
        </div>
      </div>
    </template>
  </Dialog>
</template>
