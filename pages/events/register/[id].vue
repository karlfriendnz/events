<!--
  Staff "register on behalf" page for an event.

  The staff-side counterpart to the public /r/event/:id page — same <FormRenderer>,
  same submit endpoint, but inside the app chrome and with `staff` enabled so the
  member-picker is available (pick an existing member → their full saved profile
  pre-fills). Reached from the event's Invitees tab → "Register someone".
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

definePageMeta({ layout: 'default' })

const route = useRoute()
const db = useDb()
const toast = useToast()

const eventId = computed(() => String(route.params.id || ''))

const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const done = ref(false)

const config = ref<any>(null)
const orgId = ref('')
const eventTitle = ref('')
const eventInfo = ref<any>(null)
const sessions = ref<any[]>([])
const feeLineItems = ref<{ name: string; amount: number }[]>([])
const currency = ref('NZD')

async function load() {
  loading.value = true; loadError.value = ''
  try {
    const { data: ev } = await (db.from as any)('events')
      .select('id, org_id, title, form_id, status, banner_url, start_at, description, location_type, address')
      .eq('id', eventId.value).maybeSingle()
    if (!ev) { loadError.value = 'This event could not be found.'; return }
    orgId.value = ev.org_id; eventTitle.value = ev.title
    eventInfo.value = {
      title: ev.title, banner_url: ev.banner_url, start_at: ev.start_at, description: ev.description,
      location: ev.location_type === 'ONLINE' ? 'Online' : (ev.address || null),
    }

    const [{ data: org }, { data: form }, { data: feeRows }, { data: sess }] = await Promise.all([
      (db.from as any)('organisations').select('currency').eq('id', ev.org_id).maybeSingle(),
      ev.form_id ? (db.from as any)('registration_forms').select('id, config').eq('id', ev.form_id).maybeSingle() : Promise.resolve({ data: null }),
      (db.from as any)('fee_components').select('name, amount, session_id').eq('event_id', eventId.value),
      (db.from as any)('sessions').select('id, title, start_at, is_required, display_on_form').eq('event_id', eventId.value).order('sort_order'),
    ])
    currency.value = org?.currency || 'NZD'
    if (!form) { loadError.value = 'No registration form has been set up for this event yet.'; return }
    config.value = { ...(form.config || {}), _formId: form.id }

    feeLineItems.value = (feeRows ?? []).filter((f: any) => !f.session_id).map((f: any) => ({ name: f.name, amount: Number(f.amount) || 0 }))
    const feeBySession: Record<string, number> = {}
    for (const f of (feeRows ?? [])) if (f.session_id) feeBySession[f.session_id] = (feeBySession[f.session_id] || 0) + (Number(f.amount) || 0)
    sessions.value = (sess ?? []).map((s: any) => ({
      id: s.id, title: s.title, start_at: s.start_at,
      required: !!s.is_required, display: s.display_on_form !== false, fee: feeBySession[s.id] || 0,
    }))
  } catch (e: any) {
    loadError.value = e?.message || 'Something went wrong loading the form.'
  } finally {
    loading.value = false
  }
}

async function onSubmit(payload: any) {
  submitting.value = true
  try {
    const res: any = await $fetch('/api/public-form-submit', { method: 'POST', body: payload })
    toast.add({ severity: 'success', summary: 'Registration added', detail: `${res?.personCount ?? 0} person(s) registered`, life: 3000 })
    done.value = true
    setTimeout(() => navigateTo(`/events/${eventId.value}?tab=invitees`), 800)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.data?.message || e?.message, life: 5000 })
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="p-3 sm:p-6 max-w-[1000px] mx-auto">
    <button class="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3"
      @click="navigateTo(`/events/${eventId}?tab=invitees`)">
      <i class="pi pi-chevron-left text-xs" /> Back to event
    </button>
    <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Register someone</p>

    <div class="card overflow-hidden">
      <div v-if="loading" class="py-16 text-center text-gray-400"><i class="pi pi-spin pi-spinner text-2xl" /></div>

      <div v-else-if="loadError && !done" class="py-10 px-6 text-center">
        <i class="pi pi-exclamation-circle text-3xl text-gray-300 mb-3 block" />
        <p class="text-sm text-gray-600">{{ loadError }}</p>
      </div>

      <div v-else-if="done" class="py-12 px-6 text-center">
        <div class="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center bg-primary">
          <i class="pi pi-check text-white text-xl" />
        </div>
        <h2 class="text-lg font-bold text-gray-900">Registration added</h2>
        <p class="text-sm text-gray-500 mt-1">Taking you back to the event…</p>
      </div>

      <FormRenderer v-else-if="config"
        :config="config"
        :context="{ type: 'event', id: eventId, orgId }"
        :event="eventInfo"
        :sessions="sessions"
        :fee-line-items="feeLineItems"
        :currency="currency"
        :submitting="submitting"
        staff
        @submit="onSubmit" />
    </div>
    <Toast />
  </div>
</template>
