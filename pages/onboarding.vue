<!--
  New-club setup wizard (migration 247). Teaches each concept AND writes real
  data as the admin goes. Core steps (Your club, Your first season) can't be
  skipped and gate entry to the app (see middleware/onboarding.global.ts); the
  rest are optional and nudged from the dashboard until finished/dismissed.
-->
<script setup lang="ts">
definePageMeta({ layout: 'default' })
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const ob = useOnboarding()
const gc = useGroupCodes()
const tm = useTermsMemberships()
const gf = useGroupFees()

const loading = ref(true)
const saving = ref(false)
const state = ref(ob.resolve(null))
const stepIndex = ref(0)
const steps = ob.ONBOARDING_STEPS
const current = computed(() => steps[stepIndex.value])

// ── Per-step models ──
const club = reactive({ name: '', sport: '', currency: 'NZD', locale: 'en-NZ' })
const season = reactive({ name: '', start: null as Date | null, end: null as Date | null, signupOpen: null as Date | null, signupClose: null as Date | null })
const programmes = ref<string[]>([])
const progInput = ref('')
const cls = reactive({ name: '', codeId: null as string | null, day: 1, start: '16:00', end: '17:00', capacity: 12 })
const feeCfg = reactive({ free: false, name: 'Term fee', amount: null as number | null })
const team = ref<{ email: string; role: string }[]>([])
const teamInput = reactive({ email: '', role: 'coach' })

// created ids threaded between steps
const created = reactive<{ seasonId: string | null; codeIds: string[]; classId: string | null; formId: string | null }>({ seasonId: null, codeIds: [], classId: null, formId: null })
const existingCodes = ref<{ id: string; name: string }[]>([])

const DAYS = [{ label: 'Monday', value: 1 }, { label: 'Tuesday', value: 2 }, { label: 'Wednesday', value: 3 }, { label: 'Thursday', value: 4 }, { label: 'Friday', value: 5 }, { label: 'Saturday', value: 6 }, { label: 'Sunday', value: 0 }]
const orgSports = ref<{ id: string; sport: string }[]>([])

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [{ data: org }, st, { data: sports }, codes] = await Promise.all([
    (db.from as any)('organisations').select('name, currency, locale').eq('id', orgId.value).maybeSingle(),
    ob.load(),
    (db.from as any)('org_sports').select('id, sport, display_name').eq('org_id', orgId.value).order('sort_order'),
    gc.loadCodes(),
  ])
  club.name = org?.name ?? ''
  club.currency = org?.currency ?? 'NZD'
  club.locale = org?.locale ?? 'en-NZ'
  orgSports.value = (sports ?? []).map((s: any) => ({ id: s.id, sport: s.display_name || s.sport }))
  club.sport = orgSports.value[0]?.sport ?? ''
  existingCodes.value = (codes ?? []).map((c: any) => ({ id: c.id, name: c.name }))
  created.codeIds = existingCodes.value.map(c => c.id)
  state.value = st
  // resume at the first unfinished step
  const firstUnfinished = steps.findIndex(s => !st.steps?.[s.key])
  stepIndex.value = firstUnfinished < 0 ? steps.length - 1 : firstUnfinished
  loading.value = false
}
onMounted(load)

function goto(i: number) {
  // only allow jumping to a step whose predecessors' CORE steps are done
  if (i <= stepIndex.value || i === firstIncomplete.value) stepIndex.value = i
}
const firstIncomplete = computed(() => {
  const idx = steps.findIndex(s => !state.value.steps?.[s.key])
  return idx < 0 ? steps.length - 1 : idx
})

function isDone(key: string) { return !!state.value.steps?.[key] }
async function markDone(key: string) { state.value = await ob.completeStep(key, state.value) }
function next() { if (stepIndex.value < steps.length - 1) stepIndex.value++ }
function toIso(d: Date | null) { return d ? d.toISOString().slice(0, 10) : null }

// ── Step savers (write real data) ──
async function saveClub() {
  if (!club.name.trim()) { toast.add({ severity: 'warn', summary: 'Give your club a name', life: 2500 }); return }
  saving.value = true
  await (db.from as any)('organisations').update({ name: club.name.trim(), currency: club.currency, locale: club.locale }).eq('id', orgId.value)
  // primary sport
  if (club.sport.trim() && !orgSports.value.some(s => s.sport.toLowerCase() === club.sport.trim().toLowerCase())) {
    await (db.from as any)('org_sports').insert({ org_id: orgId.value, sport: club.sport.trim(), is_primary: orgSports.value.length === 0, sort_order: orgSports.value.length })
  }
  await markDone('club'); saving.value = false; next()
}

async function saveTypes() {
  saving.value = true
  const STANDARD = [
    { key: 'member', label: 'Member', is_access: false }, { key: 'parent', label: 'Parent', is_access: false },
    { key: 'emergency_contact', label: 'Emergency contact', is_access: false }, { key: 'coach', label: 'Coach', is_access: true },
    { key: 'manager', label: 'Manager', is_access: true }, { key: 'admin', label: 'Admin', is_access: true },
  ]
  const { data: existing } = await (db.from as any)('person_target_types').select('key').eq('org_id', orgId.value).eq('kind', 'person')
  const have = new Set((existing ?? []).map((x: any) => x.key))
  const rows = STANDARD.filter(s => !have.has(s.key)).map((s, i) => ({ org_id: orgId.value, key: s.key, label: s.label, kind: 'person', is_access: s.is_access, sort_order: i }))
  if (rows.length) await (db.from as any)('person_target_types').insert(rows)
  await markDone('types'); saving.value = false; next()
}

async function saveSeason() {
  if (!season.name.trim() || !season.start || !season.end) { toast.add({ severity: 'warn', summary: 'Name and dates are needed', life: 2500 }); return }
  saving.value = true
  const { data } = await (db.from as any)('org_terms').insert({
    org_id: orgId.value, name: season.name.trim(), start_date: toIso(season.start), end_date: toIso(season.end),
    signup_open: toIso(season.signupOpen), signup_close: toIso(season.signupClose), status: 'active', sort_order: 0,
  }).select('id').maybeSingle()
  created.seasonId = data?.id ?? null
  await markDone('season'); saving.value = false; next()
}

async function saveProgrammes() {
  saving.value = true
  const PALETTE = ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#06B6D4']
  const ids: string[] = [...created.codeIds]
  for (const [i, name] of programmes.value.entries()) {
    const code = await gc.createCode({ name, color: PALETTE[i % PALETTE.length], term_id: created.seasonId, sort_order: existingCodes.value.length + i })
    if (code) { ids.push(code.id); existingCodes.value.push({ id: code.id, name }) }
  }
  created.codeIds = ids
  if (!cls.codeId && existingCodes.value.length) cls.codeId = existingCodes.value[0].id
  await markDone('programmes'); saving.value = false; next()
}

async function saveClass() {
  if (!cls.name.trim()) { toast.add({ severity: 'warn', summary: 'Name the class', life: 2500 }); return }
  saving.value = true
  const { data: g } = await (db.from as any)('member_groups').insert({
    org_id: orgId.value, name: cls.name.trim(), code_id: cls.codeId, term_id: created.seasonId, capacity: cls.capacity || null, kind: 'class',
  }).select('id').maybeSingle()
  created.classId = g?.id ?? null
  if (created.classId) {
    await (db.from as any)('member_group_schedules').insert({
      org_id: orgId.value, group_id: created.classId, day_of_week: cls.day, start_time: cls.start, end_time: cls.end, sort_order: 0,
    })
  }
  await markDone('class'); saving.value = false; next()
}

async function saveFees() {
  saving.value = true
  if (created.classId) {
    const amount = feeCfg.free ? 0 : (feeCfg.amount ?? 0)
    await gf.saveFeeOptions(created.classId, [{
      id: `tmp-0`, name: feeCfg.free ? 'Free' : (feeCfg.name.trim() || 'Term fee'), fee_type: 'upfront',
      items: [{ id: 'i0', name: feeCfg.free ? 'Free' : (feeCfg.name.trim() || 'Term fee'), amount, account: null }],
    } as any])
  }
  await markDone('fees'); saving.value = false; next()
}

const publicLink = computed(() => created.classId ? `${location.origin}/r/group/${created.classId}` : '')
async function saveForm() {
  saving.value = true
  if (created.classId) {
    // Quick-create a standard registration form + link it (mirrors createDefaultRegForm)
    const { data: form } = await (db.from as any)('registration_forms').insert({
      org_id: orgId.value, name: `${cls.name || 'Class'} registration`,
      config: { groups: ['default'], groupProfiles: { default: [{ key: 'member', label: 'Member', min: 1, max: 1, kind: 'person', selectsOptions: true }] }, groupFields: {}, design: { style: 'tabs' } },
    }).select('id').maybeSingle()
    if (form?.id) {
      created.formId = form.id
      await (db.from as any)('member_groups').update({ form_id: form.id }).eq('id', created.classId)
    }
  }
  await markDone('form'); saving.value = false; next()
}

function addTeam() {
  if (!teamInput.email.trim()) return
  team.value.push({ email: teamInput.email.trim(), role: teamInput.role })
  teamInput.email = ''
}
async function saveTeam() {
  saving.value = true
  for (const m of team.value) {
    await (db.from as any)('persons').upsert({ org_id: orgId.value, email: m.email, first_name: m.email.split('@')[0], person_type: m.role, person_types: [m.role] }, { onConflict: 'org_id,email' })
  }
  await markDone('team'); saving.value = false; finish()
}

async function skip() {
  if (current.value.core) return
  await markDone(current.value.key)
  if (stepIndex.value >= steps.length - 1) finish(); else next()
}

async function finish() {
  const done = { ...state.value, completed_at: ob.allDone(state.value) ? new Date().toISOString() : null }
  await ob.save(done)
  toast.add({ severity: 'success', summary: 'Your club is set up!', life: 3000 })
  navigateTo('/dashboard')
}
</script>

<template>
  <div class="p-3 sm:p-6 max-w-3xl mx-auto space-y-5">
    <div v-if="loading" class="card p-16 text-center text-gray-400"><i class="pi pi-spin pi-spinner text-2xl" /></div>

    <template v-else>
      <div>
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">Set up your club</h1>
        <p class="text-sm text-gray-500">A few quick steps — we'll explain each one and set it up as you go.</p>
      </div>

      <!-- Stepper -->
      <div class="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
        <template v-for="(s, i) in steps" :key="s.key">
          <button type="button" @click="goto(i)"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            :class="i === stepIndex ? 'bg-primary text-white' : isDone(s.key) ? 'text-emerald-600' : 'text-gray-400'">
            <i :class="['pi', isDone(s.key) && i !== stepIndex ? 'pi-check-circle' : s.icon, 'text-xs']" />
            {{ s.label }}<span v-if="s.core" class="opacity-60">*</span>
          </button>
          <i v-if="i < steps.length - 1" class="pi pi-angle-right text-gray-200 text-xs shrink-0" />
        </template>
      </div>

      <!-- Panes -->
      <div class="card p-5 sm:p-6 space-y-5">
        <!-- CLUB -->
        <template v-if="current.key === 'club'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Your club</h2>
            <p class="text-sm text-gray-500 mt-1">The basics. Your sport shapes the words the app uses (e.g. "Gymnast" vs "Member") and who you can affiliate to.</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="text-sm font-medium">Club name</label><InputText v-model="club.name" placeholder="e.g. North Harbour Gymnastics" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Main sport</label><InputText v-model="club.sport" placeholder="e.g. Gymnastics" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Currency</label><Select v-model="club.currency" :options="['NZD','AUD','GBP','USD','EUR']" class="w-full" /></div>
          </div>
        </template>

        <!-- TYPES -->
        <template v-else-if="current.key === 'types'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">People types</h2>
            <p class="text-sm text-gray-500 mt-1">Every person you track is a <em>type</em> — Member, Parent, Coach… Types decide what info you collect and what someone can do. We'll add the standard set for you; you can tweak them later in Settings → People &amp; Entities.</p>
          </div>
          <ul class="text-sm text-gray-700 space-y-1.5">
            <li v-for="l in ['Member','Parent','Emergency contact','Coach','Manager','Admin']" :key="l" class="flex items-center gap-2"><i class="pi pi-check-circle text-emerald-500 text-xs" />{{ l }}</li>
          </ul>
        </template>

        <!-- SEASON -->
        <template v-else-if="current.key === 'season'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Your first season</h2>
            <p class="text-sm text-gray-500 mt-1">A <em>season</em> (or term) is a date range your classes run in — like "Term 3 2026". The sign-up window controls when members can register. Leave sign-up dates blank to open right away.</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="text-sm font-medium">Season name</label><InputText v-model="season.name" placeholder="e.g. Term 3 2026" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Starts</label><DatePicker v-model="season.start" dateFormat="d M yy" showIcon class="w-full" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Ends</label><DatePicker v-model="season.end" dateFormat="d M yy" showIcon class="w-full" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Sign-up opens <span class="text-gray-400 font-normal">— optional</span></label><DatePicker v-model="season.signupOpen" dateFormat="d M yy" showIcon class="w-full" placeholder="Right away" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Sign-up closes <span class="text-gray-400 font-normal">— optional</span></label><DatePicker v-model="season.signupClose" dateFormat="d M yy" showIcon class="w-full" placeholder="Season end" /></div>
          </div>
        </template>

        <!-- PROGRAMMES -->
        <template v-else-if="current.key === 'programmes'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Programmes</h2>
            <p class="text-sm text-gray-500 mt-1">A <em>programme</em> groups related classes — like "Recreational" vs "Competitive". They keep your classes organised and pass settings (like the season) down to the classes inside. Add a few, or skip and add them later.</p>
          </div>
          <div v-if="existingCodes.length" class="flex flex-wrap gap-1.5">
            <span v-for="c in existingCodes" :key="c.id" class="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{{ c.name }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span v-for="(p, i) in programmes" :key="i" class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">{{ p }}<button type="button" @click="programmes.splice(i,1)"><i class="pi pi-times text-[9px]" /></button></span>
          </div>
          <div class="flex items-center gap-2">
            <InputText v-model="progInput" placeholder="e.g. Recreational" class="flex-1" @keyup.enter="progInput.trim() && (programmes.push(progInput.trim()), progInput='')" />
            <Button icon="pi pi-plus" label="Add" size="small" :disabled="!progInput.trim()" @click="programmes.push(progInput.trim()); progInput=''" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </template>

        <!-- CLASS -->
        <template v-else-if="current.key === 'class'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Your first class</h2>
            <p class="text-sm text-gray-500 mt-1">A <em>class</em> is a group of people who train together — with a time, a coach and a roster. Let's create one so you can see how it works.</p>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5 sm:col-span-2"><label class="text-sm font-medium">Class name</label><InputText v-model="cls.name" placeholder="e.g. Monday Beginners" /></div>
            <div v-if="existingCodes.length" class="flex flex-col gap-1.5"><label class="text-sm font-medium">Programme</label><Select v-model="cls.codeId" :options="existingCodes" optionLabel="name" optionValue="id" class="w-full" placeholder="Ungrouped" show-clear /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Capacity</label><InputNumber v-model="cls.capacity" :min="0" class="w-full" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Day</label><Select v-model="cls.day" :options="DAYS" optionLabel="label" optionValue="value" class="w-full" /></div>
            <div class="grid grid-cols-2 gap-2">
              <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Start</label><InputText v-model="cls.start" placeholder="16:00" /></div>
              <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">End</label><InputText v-model="cls.end" placeholder="17:00" /></div>
            </div>
          </div>
        </template>

        <!-- FEES -->
        <template v-else-if="current.key === 'fees'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Fees</h2>
            <p class="text-sm text-gray-500 mt-1">How much it costs to join <b>{{ cls.name || 'this class' }}</b>. You can offer several ways to pay later — for now, one price (or free) gets you signup-ready.</p>
          </div>
          <label class="flex items-center gap-2.5 cursor-pointer text-sm"><Checkbox v-model="feeCfg.free" binary /> This class is free</label>
          <div v-if="!feeCfg.free" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Fee name</label><InputText v-model="feeCfg.name" placeholder="Term fee" /></div>
            <div class="flex flex-col gap-1.5"><label class="text-sm font-medium">Amount</label><InputNumber v-model="feeCfg.amount" mode="currency" :currency="club.currency" :min="0" class="w-full" /></div>
          </div>
        </template>

        <!-- FORM -->
        <template v-else-if="current.key === 'form'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Registration link</h2>
            <p class="text-sm text-gray-500 mt-1">We'll create a public sign-up form for your class and give you a link to share — anyone can register from it, no login needed. You can redesign the form anytime.</p>
          </div>
          <div v-if="created.formId" class="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
            <p class="font-medium">Your public link is ready:</p>
            <code class="text-xs break-all">{{ publicLink }}</code>
          </div>
          <p v-else class="text-sm text-gray-500">Click "Create link" below to generate a standard First name / Last name / Email / Phone form.</p>
        </template>

        <!-- TEAM -->
        <template v-else-if="current.key === 'team'">
          <div>
            <h2 class="text-base font-semibold text-gray-900">Invite your team</h2>
            <p class="text-sm text-gray-500 mt-1">Add the coaches and admins who'll help run the club. We'll add them as people now; you can grant logins later. Skip if it's just you for now.</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <div v-for="(m, i) in team" :key="i" class="flex items-center gap-2 text-sm"><i class="pi pi-user text-gray-400" /><span class="flex-1">{{ m.email }}</span><span class="text-xs text-gray-400">{{ m.role }}</span><button type="button" @click="team.splice(i,1)" class="text-gray-300 hover:text-red-500"><i class="pi pi-times-circle text-sm" /></button></div>
            <div class="flex items-center gap-2">
              <InputText v-model="teamInput.email" placeholder="email@club.com" class="flex-1" @keyup.enter="addTeam" />
              <Select v-model="teamInput.role" :options="[{label:'Coach',value:'coach'},{label:'Manager',value:'manager'},{label:'Admin',value:'admin'}]" optionLabel="label" optionValue="value" class="w-32" />
              <Button icon="pi pi-plus" size="small" @click="addTeam" style="background:#1E2157;border-color:#1E2157" />
            </div>
          </div>
        </template>

        <!-- Footer -->
        <div class="flex items-center justify-between pt-3 border-t border-gray-100">
          <button v-if="!current.core" type="button" class="text-sm text-gray-400 hover:text-gray-700" @click="skip">Skip for now</button>
          <span v-else />
          <div class="flex items-center gap-2">
            <Button v-if="current.key === 'club'" label="Save & continue" :loading="saving" @click="saveClub" style="background:#1E2157;border-color:#1E2157" />
            <Button v-else-if="current.key === 'types'" label="Add these & continue" :loading="saving" @click="saveTypes" style="background:#1E2157;border-color:#1E2157" />
            <Button v-else-if="current.key === 'season'" label="Save & continue" :loading="saving" @click="saveSeason" style="background:#1E2157;border-color:#1E2157" />
            <Button v-else-if="current.key === 'programmes'" :label="programmes.length ? 'Create & continue' : 'Continue'" :loading="saving" @click="saveProgrammes" style="background:#1E2157;border-color:#1E2157" />
            <Button v-else-if="current.key === 'class'" label="Create class & continue" :loading="saving" @click="saveClass" style="background:#1E2157;border-color:#1E2157" />
            <Button v-else-if="current.key === 'fees'" label="Save & continue" :loading="saving" @click="saveFees" style="background:#1E2157;border-color:#1E2157" />
            <Button v-else-if="current.key === 'form'" :label="created.formId ? 'Continue' : 'Create link & continue'" :loading="saving" @click="saveForm" style="background:#1E2157;border-color:#1E2157" />
            <Button v-else-if="current.key === 'team'" label="Finish setup" :loading="saving" @click="saveTeam" style="background:#1E2157;border-color:#1E2157" />
          </div>
        </div>
      </div>
    </template>
    <Toast />
  </div>
</template>
