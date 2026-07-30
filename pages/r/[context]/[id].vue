<!--
  Public registration page — the live consumer of <FormRenderer>.

  URL: /r/:context/:id   e.g. /r/event/<eventId>, /r/group/<groupId>
  Reusable: the page resolves the context entity (event/group/…), its linked
  registration form (registration_forms.config), org theme, and — for events —
  sessions + fee components, then hands them to the context-agnostic renderer.
  Submission posts to /api/public-form-submit which materialises per context.

  Anonymous-friendly: all reads go through the PUBLIC seam (/api/v1/public/**) via
  usePublicApi + the forms seam via useFormsApi — no direct DB access for guests.
-->
<script setup lang="ts">
definePageMeta({ layout: 'embed' })

const route = useRoute()
// PUBLIC registration page (layout `embed`, anonymous). All its reads now go through
// seams: the form CONFIG (with builder→renderer normalisation) via useFormsApi, and
// everything else — org theme, event+sessions+fees+discounts, group+fee-options+status,
// the form's connected classes — via the PUBLIC seam usePublicApi (/api/v1/public/**).
const publicApi = usePublicApi()
const formsApi = useFormsApi()

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
const discounts = ref<any[]>([])
const feeOptions = ref<{ id: string; name: string; label: string; total: number; description?: string | null }[]>([])
// Group capacity: when the class is full we warn up-front, offer the equivalent
// groups with space (siblings on the same waitlist), and the submit lands on the
// waitlist instead of the roster (server decides; `waitlisted` echoes it back).
const groupFull = ref(false)
const waitlistName = ref('')
const siblingsWithSpace = ref<{ id: string; name: string; spaces: number | null; link: string }[]>([])
const waitlisted = ref(false)
const currency = ref('NZD')
const orgName = ref('')
const orgLogo = ref<string | null>(null)
const bannerUrl = ref<string | null>(null)
const formEvent = ref<any>(null)   // drives <FormRenderer>'s designed banner/info/description

// ?person= — arriving from an invitation the member has already accepted on their own
// profile, where they were identified by the (event, person) pair. The form opens
// filled in for them instead of asking who they are again.
const identifyPersonId = computed(() => (useRoute().query.person as string) || null)

const theme = ref<{ canvas: string; primary: string; on_primary: string }>({ canvas: '#F5F8FA', primary: '#1E2157', on_primary: '#FFFFFF' })
// Embed options (query params from the "Add to website" snippet).
const embedBg = computed(() => (route.query.bg as string) || theme.value.canvas)
const embedHideHeader = computed(() => route.query.header === '0')
const embedBorder = computed(() => route.query.border !== '0')
const embedBtnColor = computed(() => (route.query.btn as string) || theme.value.primary)
const embedHideDiscounts = computed(() => route.query.discounts === '0')
const embedLoginToSystem = computed(() => route.query.login === '1')
const themeVars = computed(() => ({ '--brand-primary': embedBtnColor.value }))

async function loadOrg(id: string) {
  const org = await publicApi.org(id).catch(() => null)
  if (org) {
    orgName.value = org.name || ''
    orgLogo.value = org.logoUrl || null
    currency.value = org.currency || 'NZD'
    const t = org.bookerTheme || {}
    theme.value = { canvas: t.canvas || '#F5F8FA', primary: t.primary || '#1E2157', on_primary: t.on_primary || '#FFFFFF' }
  }
}

async function loadForm(formId: string) {
  const form = await formsApi.get(formId).catch(() => null)
  if (!form) return null
  let cfg: any = { ...(form.config || {}) }
  // Forms built in <FormBuilder> (/forms/:id, /events/new-basic) persist a flat
  // field list in form_fields + config.profiles/fieldMeta — NOT the renderer's
  // groups/groupProfiles/groupFields shape. Normalise so both builders render.
  if (!Array.isArray(cfg.groups) || !cfg.groups.length) cfg = await normalizeBuilderConfig(form.id, cfg)
  cfg._formId = form.id
  cfg._formName = form.name || ''
  return cfg
}

// ── FormBuilder-shape → FormRenderer-shape normaliser ─────────────────────────
const FF_TYPE: Record<string, string> = {
  SHORT_TEXT: 'text', LONG_TEXT: 'textarea', SINGLE_SELECT: 'select', MULTI_SELECT: 'select',
  TOGGLE: 'checkbox', NUMBER: 'number', DATE: 'date', FILE: 'file',
}
const CORE_ACCOUNT: Record<string, string> = { first_name: 'first', last_name: 'last', email: 'email' }
const CORE_BY_LABEL: Record<string, string> = {
  'First Name': 'first_name', 'Last Name': 'last_name', 'Email Address': 'email', 'Phone Number': 'phone',
}
async function normalizeBuilderConfig(formId: string, cfg: any) {
  const ff = await formsApi.fields(formId)
  const gid = 'default'
  const fieldMeta = cfg.fieldMeta ?? {}
  // Subjects: the form's declared profiles, else one implicit person. The first
  // person profile is the chooser (sessions / fee options attach to it).
  let profiles: any[] = (cfg.profiles ?? []).filter((p: any) => p && (p.label || p.key))
  if (!profiles.length) profiles = [{ key: 'person', label: 'Person', heading: 'Your details', min: 1, max: 1, kind: 'person' }]
  const firstPerson = profiles.find((p: any) => (p.kind ?? 'person') !== 'entity') ?? profiles[0]
  profiles = profiles.map((p: any) => ({
    ...p,
    min: p.min ?? 1,
    selectsOptions: p.selectsOptions ?? (p.key === firstPerson.key),
  }))
  const fields = ff.map((row) => {
    // options is a plain array off the seam (json column), not a JSON string.
    const options: string[] = Array.isArray(row.options) ? row.options : []
    const meta = fieldMeta[row.label] ?? {}
    const core = meta.core ?? CORE_BY_LABEL[row.label]
    return {
      id: row.id,
      label: row.label,
      field_type: FF_TYPE[row.fieldType] ?? 'text',
      placeholder: row.placeholder ?? '',
      helper_text: row.helpText ?? '',
      has_helper_text: !!row.helpText,
      is_required: !!row.isRequired,
      options,
      col_span: meta.col_span ?? 2,
      account: core ? CORE_ACCOUNT[core] : undefined,
      pinned: core === 'first_name' || core === 'last_name',
      visibility_conditions: meta.visibility_conditions ?? [],
      target: firstPerson.key,
    }
  })
  return {
    ...cfg,
    groups: [{ id: gid, audience: 'public' }],
    designs: { [gid]: { formHeading: cfg.settings?.formHeading || 'Fill in the form to register' } },
    groupProfiles: { [gid]: profiles },
    groupFields: { [gid]: fields },
    terms: cfg.terms ?? [],
  }
}

async function load() {
  loading.value = true; loadError.value = ''
  try {
    let formId: string | null = null

    if (contextType.value === 'event') {
      // The public seam bundles the event meta + sessions + event-level fee lines +
      // active discounts in one call (PUBLISHED/dated gating + narrowing live in the
      // repo). null = not available (not found or closed) — one message, by design.
      const ev = await publicApi.event(contextId.value)
      if (!ev) { loadError.value = 'This event is not available for registration.'; return }
      orgId.value = ev.orgId; contextName.value = ev.title; bannerUrl.value = ev.bannerUrl || null
      formEvent.value = {
        title: ev.title, banner_url: ev.bannerUrl, start_at: ev.startAt, description: ev.description,
        location: ev.locationType === 'ONLINE' ? 'Online' : (ev.address || null),
        age_min: ev.ageMin ?? null, age_max: ev.ageMax ?? null,
        gender_restriction: ev.genderRestriction ?? null,
      }
      formId = ev.formId
      await loadOrg(ev.orgId)
      // Map the seam's camelCase session/discount shapes to the snake_case fields
      // <FormRenderer> reads.
      sessions.value = ev.sessions.map((s) => ({
        id: s.id, title: s.title, start_at: s.startAt, required: s.required, display: s.display, fee: s.fee,
      }))
      feeLineItems.value = ev.feeLineItems
      // Forward the WHOLE discount (conditions / apply_to / valid_from / expires_at /
      // is_active) — NOT just the display fields — so useDiscountEval can evaluate each
      // rule per registrant instead of applying every active discount to everyone.
      // useDiscountEval reads camelCase too, so the seam fields pass through as-is; we
      // add the snake aliases the renderer's label + eval expect. (NB: the public event
      // seam must expose those fields — see the spec handed to the lead.)
      discounts.value = ev.discounts.map((d: any) => ({
        ...d,
        form_text: d.formText,
        modifier_type: d.modifierType,
        modifier_value: d.modifierValue,
        is_active: d.isActive ?? true,
      }))
    } else if (contextType.value === 'group') {
      // The public seam bundles the class meta + fee options + full/waitlist status +
      // equivalent classes with space — never the roster, only counts.
      const g = await publicApi.group(contextId.value)
      if (!g) { loadError.value = 'This class could not be found.'; return }
      orgId.value = g.orgId; contextName.value = g.name; bannerUrl.value = g.imageUrl || null
      formEvent.value = { title: g.name, banner_url: g.imageUrl || null }
      formId = (route.query.form_id as string) || g.formId || null
      await loadOrg(g.orgId)
      feeOptions.value = g.feeOptions
      // Full-class status (offer the equivalent classes with space; the submit lands
      // on the waitlist server-side). A sibling link carries the current form_id only
      // when that sibling has no form of its own.
      groupFull.value = g.full
      waitlistName.value = g.waitlistName || ''
      siblingsWithSpace.value = g.siblingsWithSpace.map((s) => ({
        id: s.id, name: s.name, spaces: s.spaces,
        link: `/r/group/${s.id}${s.formId ? '' : (formId ? `?form_id=${formId}` : '')}`,
      }))
    } else {
      // Generic: /r/form/:formId (a form connected to 1+ groups, migration 228)
      // or a bare form by ?form_id (enquiries etc.)
      formId = contextType.value === 'form' ? contextId.value : ((route.query.form_id as string) || null)
    }

    if (!formId) { loadError.value = 'No registration form has been set up yet.'; return }
    const cfg = await loadForm(formId)
    if (!cfg) { loadError.value = 'The registration form could not be loaded.'; return }
    if (!orgId.value && cfg.org_id) { orgId.value = cfg.org_id; await loadOrg(cfg.org_id) }
    if (!contextName.value && cfg._formName) contextName.value = cfg._formName
    config.value = cfg
    // Form context: the connected classes become the in-form "Choose your class" block.
    if (contextType.value === 'form') await loadFormTargets(formId)
  } catch (e: any) {
    loadError.value = e?.message || 'Something went wrong loading this form.'
  } finally {
    loading.value = false
  }
}

// The form's connected classes (registration_form_targets → member_groups), each
// with live spaces + its fee options, for the in-form class chooser. The public seam
// does the whole job: expand CODE/programme targets to their subtree (dynamic — new
// classes appear automatically), drop ended terms, order by code tree, attach spaces +
// fee options. The returned target shape already matches groupChoices exactly.
const groupChoices = ref<any[]>([])
async function loadFormTargets(fid: string) {
  const f = await publicApi.form(fid)
  if (f) groupChoices.value = f.targets
}

async function onSubmit(payload: any) {
  submitting.value = true
  try {
    const res: any = await $fetch('/api/public-form-submit', { method: 'POST', body: payload })
    waitlisted.value = !!res?.waitlisted
    done.value = true
  } catch (e: any) {
    loadError.value = e?.data?.message || e?.message || 'Submission failed — please try again.'
  } finally {
    submitting.value = false
  }
}

// Embedded (inside an iframe on someone's site): report our content height to the
// parent so the iframe can auto-size, and drop the full-screen min-height so there's
// no empty space below the form.
const isEmbedded = ref(false)
let _heightRO: ResizeObserver | null = null
function postEmbedHeight() {
  if (!import.meta.client || window.self === window.top) return
  const h = Math.ceil(document.documentElement.scrollHeight)
  window.parent.postMessage({ type: 'fm-embed-height', id: contextId.value, height: h }, '*')
}
onMounted(async () => {
  if (import.meta.client) isEmbedded.value = window.self !== window.top
  await load()
  if (isEmbedded.value && import.meta.client) {
    postEmbedHeight()
    _heightRO = new ResizeObserver(() => postEmbedHeight())
    _heightRO.observe(document.body)
    window.addEventListener('load', postEmbedHeight)
  }
})
onBeforeUnmount(() => _heightRO?.disconnect())
</script>

<template>
  <div class="w-full" :class="isEmbedded ? '' : 'min-h-screen'" :style="{ ...themeVars, background: embedBg }">
    <div class="mx-auto w-full max-w-[1200px]" :class="isEmbedded ? 'px-2 py-2' : 'px-4 py-8'">
      <div class="bg-white rounded-2xl overflow-hidden" :class="embedBorder ? 'border border-gray-200' : ''">
        <div v-if="loading" class="py-16 text-center text-gray-400">
          <i class="pi pi-spin pi-spinner text-2xl" />
        </div>

        <div v-else-if="loadError && !done" class="py-10 px-6 text-center">
          <i class="pi pi-exclamation-circle text-3xl text-gray-300 mb-3 block" />
          <p class="text-sm text-gray-600">{{ loadError }}</p>
        </div>

        <div v-else-if="done" class="py-12 px-6 text-center">
          <div class="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" :style="{ background: theme.primary }">
            <i :class="waitlisted ? 'pi pi-hourglass' : 'pi pi-check'" class="text-white text-xl" />
          </div>
          <template v-if="waitlisted">
            <h2 class="text-lg font-bold text-gray-900">You're on the waitlist</h2>
            <p class="text-sm text-gray-500 mt-1">{{ contextType === 'group' ? contextName : 'The class you chose' }} is currently full — we've added you to the waitlist and will be in touch as soon as a spot opens up.</p>
          </template>
          <template v-else>
            <h2 class="text-lg font-bold text-gray-900">You're registered!</h2>
            <p class="text-sm text-gray-500 mt-1">Thanks — we've received your registration{{ contextName ? ' for ' + contextName : '' }}.</p>
          </template>
        </div>

        <template v-else-if="config">
        <!-- Full-class notice: offer the equivalent classes with space, else the waitlist -->
        <div v-if="groupFull" class="bg-amber-50 border-b border-amber-100 px-4 sm:px-6 py-4">
          <p class="text-sm text-amber-900">
            <i class="pi pi-exclamation-triangle text-amber-500 mr-1.5" />
            <span class="font-semibold">{{ contextName }} is currently full.</span>
            <span v-if="waitlistName"> You can still register below to join the waitlist.</span>
          </p>
          <div v-if="siblingsWithSpace.length" class="mt-2.5">
            <p class="text-xs font-semibold text-amber-800 mb-1.5">These classes run the same programme and have space:</p>
            <div class="flex flex-wrap gap-2">
              <a v-for="s in siblingsWithSpace" :key="s.id" :href="s.link"
                class="inline-flex items-center gap-1.5 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-amber-400 transition-colors">
                {{ s.name }}
                <span v-if="s.spaces != null" class="text-emerald-600">{{ s.spaces }} {{ s.spaces === 1 ? 'space' : 'spaces' }}</span>
                <i class="pi pi-arrow-right text-[9px] text-gray-400" />
              </a>
            </div>
          </div>
        </div>

        <FormRenderer
          :config="config"
          :context="{ type: contextType, id: contextId, orgId }"
          :event="formEvent || { title: contextName, banner_url: bannerUrl }"
          :sessions="sessions"
          :fee-line-items="feeLineItems"
          :discounts="embedHideDiscounts ? [] : discounts"
          :hide-header="embedHideHeader"
          :register-to-login="embedLoginToSystem"
          :fee-options="feeOptions"
          :group-options="groupChoices"
          :currency="currency"
          :submitting="submitting"
          :identify-person-id="identifyPersonId"
          @submit="onSubmit" />
        </template>
      </div>

      <p class="text-center text-xs text-gray-400 mt-4">Powered by FriendlyManager</p>
    </div>
  </div>
</template>
