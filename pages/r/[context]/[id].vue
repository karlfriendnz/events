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

const theme = ref<{ canvas: string; primary: string; on_primary: string }>({ canvas: '#F5F8FA', primary: '#1E2157', on_primary: '#FFFFFF' })
const themeVars = computed(() => ({ '--brand-primary': theme.value.primary }))

// Embed options (query params from the "Add to website" snippet).
const embedBg = computed(() => (route.query.bg as string) || theme.value.canvas)
const embedHideHeader = computed(() => route.query.header === '0')
const embedLoginUrl = computed(() => (route.query.login as string) || '')

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
  const { data: form } = await (db.from as any)('registration_forms').select('id, org_id, name, config').eq('id', formId).maybeSingle()
  if (!form) return null
  let cfg = { ...(form.config || {}) }
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
  const { data: ff } = await (db.from as any)('form_fields').select('*').eq('form_id', formId).order('sort_order')
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
  const fields = (ff ?? []).map((row: any) => {
    let options: string[] = []
    try { options = JSON.parse(row.options || '[]') } catch { options = [] }
    const meta = fieldMeta[row.label] ?? {}
    const core = meta.core ?? CORE_BY_LABEL[row.label]
    return {
      id: row.id,
      label: row.label,
      field_type: FF_TYPE[row.field_type] ?? 'text',
      placeholder: row.placeholder ?? '',
      helper_text: row.help_text ?? '',
      has_helper_text: !!row.help_text,
      is_required: !!row.is_required,
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
      const { data: ev } = await (db.from as any)('events')
        .select('id, org_id, title, form_id, status, banner_url, start_at, description, location_type, address, age_min, age_max')
        .eq('id', contextId.value).maybeSingle()
      if (!ev) { loadError.value = 'This event could not be found.'; return }
      if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') { loadError.value = 'Registrations are closed for this event.'; return }
      orgId.value = ev.org_id; contextName.value = ev.title; bannerUrl.value = ev.banner_url || null
      formEvent.value = {
        title: ev.title, banner_url: ev.banner_url, start_at: ev.start_at, description: ev.description,
        location: ev.location_type === 'ONLINE' ? 'Online' : (ev.address || null),
        age_min: ev.age_min ?? null, age_max: ev.age_max ?? null,
      }
      formId = ev.form_id
      await loadOrg(ev.org_id)
      // Sessions first, then fees. Per-session fee_components are keyed by
      // session_id (NOT event_id — the wizard doesn't stamp event_id on them), so
      // fetch by event_id OR session_id, otherwise session prices come back $0.
      const { data: sess } = await (db.from as any)('sessions')
        .select('id, title, start_at, is_required, display_on_form').eq('event_id', contextId.value).order('sort_order')
      const sessionIds = (sess ?? []).map((s: any) => s.id)
      const orFilter = `event_id.eq.${contextId.value}${sessionIds.length ? `,session_id.in.(${sessionIds.join(',')})` : ''}`
      const { data: feeRows } = await (db.from as any)('fee_components').select('name, amount, session_id, event_id').or(orFilter)
      feeLineItems.value = (feeRows ?? []).filter((f: any) => !f.session_id).map((f: any) => ({ name: f.name, amount: Number(f.amount) || 0 }))
      const feeBySession: Record<string, number> = {}
      for (const f of (feeRows ?? [])) if (f.session_id) feeBySession[f.session_id] = (feeBySession[f.session_id] || 0) + (Number(f.amount) || 0)
      sessions.value = (sess ?? []).map((s: any) => ({
        id: s.id, title: s.title, start_at: s.start_at,
        required: !!s.is_required, display: s.display_on_form !== false,
        fee: feeBySession[s.id] || 0,
      }))
      // Active discounts — shown on the landing to encourage registration.
      const { data: discRows } = await (db.from as any)('discounts')
        .select('name, form_text, modifier_type, modifier_value, is_active').eq('event_id', contextId.value).eq('is_active', true)
      discounts.value = discRows ?? []
    } else if (contextType.value === 'group') {
      const { data: g } = await (db.from as any)('member_groups')
        .select('id, org_id, name, form_id, image_url, capacity, waitlist_id')
        .eq('id', contextId.value).maybeSingle()
      if (!g) { loadError.value = 'This group could not be found.'; return }
      orgId.value = g.org_id; contextName.value = g.name; bannerUrl.value = g.image_url || null
      formEvent.value = { title: g.name, banner_url: g.image_url || null }
      formId = (route.query.form_id as string) || g.form_id || null
      await loadOrg(g.org_id)
      // The group's fee options — the registrant picks how they want to pay.
      const gf = useGroupFees()
      const opts = await gf.loadFeeOptions(g.id)
      feeOptions.value = opts.map((o: any) => ({
        id: o.id, name: o.name, label: gf.priceLabel(o, currency.value),
        total: gf.optionTotal(o), description: o.description,
      }))
      await loadGroupStatus(g, formId)
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

// Roughly split staff out of a member count (same heuristic the submit API uses).
function isStaffish(row: any) {
  const keys = [row.role, ...(Array.isArray(row.roles) ? row.roles : [])].filter(Boolean).map((k: string) => String(k).toLowerCase())
  return keys.some(k => k.includes('coach') || k.includes('manager') || k === 'staff')
}

// When the class is full: name the waitlist + surface the equivalent groups
// (same waitlist) that still have space, so a full Thursday offers Friday.
async function loadGroupStatus(g: any, formId: string | null) {
  if (g.capacity == null) return
  const { data: rows } = await (db.from as any)('member_group_memberships').select('role, roles').eq('group_id', g.id)
  const memberCount = (rows ?? []).filter((r: any) => !isStaffish(r)).length
  if (memberCount < g.capacity) return
  groupFull.value = true
  if (!g.waitlist_id) return
  const [{ data: w }, { data: sibs }] = await Promise.all([
    (db.from as any)('waitlists').select('name').eq('id', g.waitlist_id).maybeSingle(),
    (db.from as any)('member_groups').select('id, name, capacity, form_id').eq('waitlist_id', g.waitlist_id).neq('id', g.id),
  ])
  waitlistName.value = w?.name || ''
  const sibList = (sibs ?? [])
  if (!sibList.length) return
  const { data: sibRows } = await (db.from as any)('member_group_memberships')
    .select('group_id, role, roles').in('group_id', sibList.map((s: any) => s.id))
  const countBy: Record<string, number> = {}
  for (const r of (sibRows ?? [])) if (!isStaffish(r)) countBy[r.group_id] = (countBy[r.group_id] || 0) + 1
  siblingsWithSpace.value = sibList
    .map((s: any) => ({
      id: s.id, name: s.name,
      spaces: s.capacity == null ? null : s.capacity - (countBy[s.id] || 0),
      link: `/r/group/${s.id}${s.form_id ? '' : (formId ? `?form_id=${formId}` : '')}`,
    }))
    .filter((s: any) => s.spaces == null || s.spaces > 0)
}

// The form's connected classes (registration_form_targets → member_groups),
// each with live spaces + its fee options, for the in-form class chooser.
// Targets can be individual GROUPS or whole CODES (programmes) — a code target
// expands to every class in its subtree (dynamic: classes added later appear
// automatically), excluding classes whose effective term has already ended.
const groupChoices = ref<any[]>([])
async function loadFormTargets(fid: string) {
  const { data: tgts } = await (db.from as any)('registration_form_targets')
    .select('target_type, target_id, sort_order').eq('form_id', fid).order('sort_order')
  const groupIds = (tgts ?? []).filter((t: any) => t.target_type === 'group').map((t: any) => t.target_id)
  const codeIds = (tgts ?? []).filter((t: any) => t.target_type === 'code').map((t: any) => t.target_id)
  if (!groupIds.length && !codeIds.length) return

  // Codes (for subtree expansion + section labels + term inheritance) + terms.
  const [{ data: codes }, { data: terms }] = await Promise.all([
    (db.from as any)('group_codes').select('id, name, parent_id, term_id, sort_order').eq('org_id', orgId.value),
    (db.from as any)('org_terms').select('id, end_date').eq('org_id', orgId.value),
  ])
  const codesById: Record<string, any> = {}
  const codeChildren: Record<string, string[]> = {}
  for (const c of (codes ?? [])) { codesById[c.id] = c; if (c.parent_id) (codeChildren[c.parent_id] ??= []).push(c.id) }
  const expandedCodes = new Set<string>()
  const stack = [...codeIds]
  while (stack.length) {
    const id = stack.pop()!
    if (expandedCodes.has(id)) continue
    expandedCodes.add(id)
    for (const k of (codeChildren[id] ?? [])) stack.push(k)
  }

  // Groups: explicit targets + everything under the expanded codes.
  const [byId, byCode] = await Promise.all([
    groupIds.length
      ? (db.from as any)('member_groups').select('id, name, capacity, waitlist_id, code_id, term_id').in('id', groupIds)
      : Promise.resolve({ data: [] }),
    expandedCodes.size
      ? (db.from as any)('member_groups').select('id, name, capacity, waitlist_id, code_id, term_id').in('code_id', [...expandedCodes])
      : Promise.resolve({ data: [] }),
  ])
  const seen = new Set<string>()
  let groups = [...(byId.data ?? []), ...(byCode.data ?? [])].filter((g: any) => !seen.has(g.id) && seen.add(g.id))

  // Drop history classes (effective term — own term_id, else walking up the
  // code chain — already ended). Term-less classes always show.
  const termEnd: Record<string, string | null> = {}
  for (const t of (terms ?? [])) termEnd[t.id] = t.end_date
  const effectiveTermId = (g: any) => {
    if (g.term_id) return g.term_id
    let c = g.code_id ? codesById[g.code_id] : null
    while (c) { if (c.term_id) return c.term_id; c = c.parent_id ? codesById[c.parent_id] : null }
    return null
  }
  const today = new Date().toISOString().slice(0, 10)
  groups = groups.filter((g: any) => {
    const end = termEnd[effectiveTermId(g) ?? ''] ?? null
    return !end || end >= today
  })
  if (!groups.length) return

  // Order by code tree (walk order), Ungrouped last, name within a section.
  const codeOrder: Record<string, number> = {}
  {
    const roots = (codes ?? []).filter((c: any) => !c.parent_id || !codesById[c.parent_id])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
    let i = 0
    const walk = (c: any) => {
      codeOrder[c.id] = i++
      const kids = (codeChildren[c.id] ?? []).map(k => codesById[k])
        .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
      kids.forEach(walk)
    }
    roots.forEach(walk)
  }
  groups.sort((a: any, b: any) =>
    (codeOrder[a.code_id] ?? 9999) - (codeOrder[b.code_id] ?? 9999) || a.name.localeCompare(b.name))

  const gf = useGroupFees()
  const ids = groups.map((g: any) => g.id)
  const [{ data: memRows }, feeLists] = await Promise.all([
    (db.from as any)('member_group_memberships').select('group_id, role, roles').in('group_id', ids),
    Promise.all(ids.map((id: string) => gf.loadFeeOptions(id))),
  ])
  const countBy: Record<string, number> = {}
  for (const r of (memRows ?? [])) if (!isStaffish(r)) countBy[r.group_id] = (countBy[r.group_id] || 0) + 1
  groupChoices.value = groups.map((g: any, i: number) => {
    const taken = countBy[g.id] || 0
    const full = g.capacity != null && taken >= g.capacity
    return {
      id: g.id, name: g.name,
      section: g.code_id ? (codesById[g.code_id]?.name ?? null) : null,
      spaces: g.capacity == null ? null : Math.max(0, g.capacity - taken),
      full, waitlistable: !!g.waitlist_id,
      feeOptions: (feeLists[i] ?? []).map((o: any) => ({
        id: o.id, name: o.name, label: gf.priceLabel(o, currency.value),
        total: gf.optionTotal(o), description: o.description,
      })),
    }
  })
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

onMounted(load)
</script>

<template>
  <div class="min-h-screen w-full" :style="{ ...themeVars, background: embedBg }">
    <div class="mx-auto px-4 py-8 w-full max-w-[1200px]">
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
          :discounts="discounts"
          :hide-header="embedHideHeader"
          :register-url="embedLoginUrl"
          :fee-options="feeOptions"
          :group-options="groupChoices"
          :currency="currency"
          :submitting="submitting"
          @submit="onSubmit" />
        </template>
      </div>

      <p class="text-center text-xs text-gray-400 mt-4">Powered by FriendlyManager</p>
    </div>
  </div>
</template>
