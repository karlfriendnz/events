<!--
  Public registration page — the live consumer of <FormRenderer>.

  URL: /r/:context/:id   e.g. /r/event/<eventId>, /r/group/<groupId>
  Reusable: the page resolves the context entity (event/group/…), its linked
  registration form (registration_forms.config), org theme, and — for events —
  sessions + fee components, then hands them to the context-agnostic renderer.
  Submission posts to /api/public-form-submit which materialises per context.

  Anonymous-friendly: these tables have no RLS, so useDb() reads work for guests
  (same as the public booker /book).
-->
<script setup lang="ts">
definePageMeta({ layout: 'embed' })

const route = useRoute()
const db = useDb()

const contextType = computed(() => String(route.params.context || ''))
const contextId = computed(() => String(route.params.id || ''))

const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const done = ref(false)

const config = ref<any>(null)
const orgId = ref('')
const contextName = ref('')
const sessions = ref<any[]>([])
const feeLineItems = ref<{ name: string; amount: number }[]>([])
const currency = ref('NZD')
const orgName = ref('')
const orgLogo = ref<string | null>(null)
const bannerUrl = ref<string | null>(null)
const formEvent = ref<any>(null)   // drives <FormRenderer>'s designed banner/info/description

const theme = ref<{ canvas: string; primary: string; on_primary: string }>({ canvas: '#F5F8FA', primary: '#1E2157', on_primary: '#FFFFFF' })
const themeVars = computed(() => ({ '--brand-primary': theme.value.primary }))

async function loadOrg(id: string) {
  const { data: org } = await (db.from as any)('organisations')
    .select('id, name, logo_url, booker_theme, currency').eq('id', id).maybeSingle()
  if (org) {
    orgName.value = org.name || ''
    orgLogo.value = org.logo_url || null
    currency.value = org.currency || 'NZD'
    const t = org.booker_theme || {}
    theme.value = { canvas: t.canvas || '#F5F8FA', primary: t.primary || '#1E2157', on_primary: t.on_primary || '#FFFFFF' }
  }
}

async function loadForm(formId: string) {
  const { data: form } = await (db.from as any)('registration_forms').select('id, org_id, config').eq('id', formId).maybeSingle()
  if (!form) return null
  const cfg = { ...(form.config || {}), _formId: form.id }
  return cfg
}

async function load() {
  loading.value = true; loadError.value = ''
  try {
    let formId: string | null = null

    if (contextType.value === 'event') {
      const { data: ev } = await (db.from as any)('events')
        .select('id, org_id, title, form_id, status, banner_url, start_at, description, location_type, address')
        .eq('id', contextId.value).maybeSingle()
      if (!ev) { loadError.value = 'This event could not be found.'; return }
      if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') { loadError.value = 'Registrations are closed for this event.'; return }
      orgId.value = ev.org_id; contextName.value = ev.title; bannerUrl.value = ev.banner_url || null
      formEvent.value = {
        title: ev.title, banner_url: ev.banner_url, start_at: ev.start_at, description: ev.description,
        location: ev.location_type === 'ONLINE' ? 'Online' : (ev.address || null),
      }
      formId = ev.form_id
      await loadOrg(ev.org_id)
      // Base (event-level) fee components + per-session fees + sessions.
      const [{ data: feeRows }, { data: sess }] = await Promise.all([
        (db.from as any)('fee_components').select('name, amount, session_id, event_id').eq('event_id', contextId.value),
        (db.from as any)('sessions').select('id, title, start_at, is_required, display_on_form').eq('event_id', contextId.value).order('sort_order'),
      ])
      feeLineItems.value = (feeRows ?? []).filter((f: any) => !f.session_id).map((f: any) => ({ name: f.name, amount: Number(f.amount) || 0 }))
      const feeBySession: Record<string, number> = {}
      for (const f of (feeRows ?? [])) if (f.session_id) feeBySession[f.session_id] = (feeBySession[f.session_id] || 0) + (Number(f.amount) || 0)
      sessions.value = (sess ?? []).map((s: any) => ({
        id: s.id, title: s.title, start_at: s.start_at,
        required: !!s.is_required, display: s.display_on_form !== false,
        fee: feeBySession[s.id] || 0,
      }))
    } else if (contextType.value === 'group') {
      const { data: g } = await (db.from as any)('member_groups').select('id, org_id, name').eq('id', contextId.value).maybeSingle()
      if (!g) { loadError.value = 'This group could not be found.'; return }
      orgId.value = g.org_id; contextName.value = g.name
      formId = (route.query.form_id as string) || null
      await loadOrg(g.org_id)
    } else {
      // Generic: a bare form by ?form_id (enquiries etc.)
      formId = (route.query.form_id as string) || null
    }

    if (!formId) { loadError.value = 'No registration form has been set up yet.'; return }
    const cfg = await loadForm(formId)
    if (!cfg) { loadError.value = 'The registration form could not be loaded.'; return }
    if (!orgId.value && cfg.org_id) { orgId.value = cfg.org_id; await loadOrg(cfg.org_id) }
    config.value = cfg
  } catch (e: any) {
    loadError.value = e?.message || 'Something went wrong loading this form.'
  } finally {
    loading.value = false
  }
}

async function onSubmit(payload: any) {
  submitting.value = true
  try {
    await $fetch('/api/public-form-submit', { method: 'POST', body: payload })
    done.value = true
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || 'Submission failed — please try again.'
  } finally {
    submitting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="min-h-screen w-full" :style="{ ...themeVars, background: theme.canvas }">
    <div class="max-w-[1000px] mx-auto px-4 py-8">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-5">
        <img v-if="orgLogo" :src="orgLogo" :alt="orgName" class="h-9 w-auto" />
        <span v-else class="text-base font-bold" :style="{ color: theme.primary }">{{ orgName }}</span>
      </div>

      <div class="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div v-if="loading" class="py-16 text-center text-gray-400">
          <i class="pi pi-spin pi-spinner text-2xl" />
        </div>

        <div v-else-if="loadError && !done" class="py-10 px-6 text-center">
          <i class="pi pi-exclamation-circle text-3xl text-gray-300 mb-3 block" />
          <p class="text-sm text-gray-600">{{ loadError }}</p>
        </div>

        <div v-else-if="done" class="py-12 px-6 text-center">
          <div class="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" :style="{ background: theme.primary }">
            <i class="pi pi-check text-white text-xl" />
          </div>
          <h2 class="text-lg font-bold text-gray-900">You're registered!</h2>
          <p class="text-sm text-gray-500 mt-1">Thanks — we've received your registration{{ contextName ? ' for ' + contextName : '' }}.</p>
        </div>

        <FormRenderer v-else-if="config"
          :config="config"
          :context="{ type: contextType, id: contextId, orgId }"
          :event="formEvent || { title: contextName, banner_url: bannerUrl }"
          :sessions="sessions"
          :fee-line-items="feeLineItems"
          :currency="currency"
          :submitting="submitting"
          @submit="onSubmit" />
      </div>

      <p class="text-center text-xs text-gray-400 mt-4">Powered by FriendlyManager</p>
    </div>
  </div>
</template>
