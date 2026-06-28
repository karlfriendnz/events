<template>
  <!-- Dev-only: one-click seeder demonstrating every booking pattern
       we've built so far — item rentals, coach bookings with venue +
       equipment requirements, venue rentals, and the booker's "By
       service" category cards. -->
  <div class="min-h-screen px-4 py-12 bg-[#F5F8FA]">
    <div class="max-w-3xl mx-auto">
      <h1 class="text-lg sm:text-2xl font-bold text-gray-900">Demo data seed</h1>
      <p class="text-sm text-gray-500 mt-1">
        Spins up a complete sample club: equipment inventory, cricket nets, tennis courts, a couple of
        coaches, and the existing item rentals (projector, lockers). Categories are tagged so the
        booker's <span class="font-semibold">By service</span> view has something to show.
      </p>
      <p class="text-xs text-amber-600 mt-2">
        Re-runs add a fresh copy each time — don't click 12 times.
      </p>

      <div class="mt-6 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <p class="text-sm font-semibold text-gray-800">What gets created</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-gray-600">
          <p class="font-semibold text-gray-500 uppercase tracking-wider text-[10px] sm:col-span-2 mt-2">Equipment (items)</p>
          <p>🎯 Bowling Machine × 2</p>
          <p>⚽ Footballs × 20</p>
          <p>🎯 Cones × 50</p>
          <p>📽️ Projector × 1</p>

          <p class="font-semibold text-gray-500 uppercase tracking-wider text-[10px] sm:col-span-2 mt-3">Venues</p>
          <p>🏏 Cricket Nets (3 children)</p>
          <p>🎾 Tennis Courts (3 children)</p>
          <p>🔒 Locker Room (10 lockers)</p>

          <p class="font-semibold text-gray-500 uppercase tracking-wider text-[10px] sm:col-span-2 mt-3">Coaches</p>
          <p>👤 <span class="font-medium">Sarah Wright</span> — Cricket</p>
          <p>👤 <span class="font-medium">Tom Singh</span> — Tennis</p>

          <p class="font-semibold text-gray-500 uppercase tracking-wider text-[10px] sm:col-span-2 mt-3">Activities (booker home)</p>
          <p>🎾 Tennis Court Hire (venue)</p>
          <p>📽️ Projector hire (item)</p>
          <p>🔒 Locker rental (item)</p>
          <p class="text-gray-400 text-xs italic">+ Sarah's & Tom's coaching activities</p>
        </div>
      </div>

      <div class="mt-6 flex items-center gap-3">
        <button type="button"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all"
          :class="seeding || clearing ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary hover:bg-[#161A45] hover:shadow-md'"
          :disabled="seeding || clearing"
          @click="seed">
          <i v-if="seeding" class="pi pi-spin pi-spinner text-[11px]" />
          <span>{{ seeding ? 'Seeding…' : 'Create demo data' }}</span>
        </button>
        <button type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all"
          :class="seeding || clearing ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-red-200 text-red-600 hover:bg-red-50'"
          :disabled="seeding || clearing"
          @click="clearDemo">
          <i v-if="clearing" class="pi pi-spin pi-spinner text-[11px]" />
          <span>{{ clearing ? 'Clearing…' : 'Clear demo data' }}</span>
        </button>
      </div>

      <div class="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
        <button type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-50"
          :disabled="seedingLinks" @click="seedPeopleLinks">
          <i :class="['pi', seedingLinks ? 'pi-spin pi-spinner' : 'pi-sitemap', 'text-[11px]']" />
          <span>{{ seedingLinks ? 'Seeding…' : 'Seed families & circles' }}</span>
        </button>
        <span v-if="linksResult" class="text-xs text-emerald-600">{{ linksResult }}</span>
      </div>
      <p class="text-[11px] text-gray-400 mt-2">Creates a demo <strong>[Demo] Smith Family</strong> (2 guardians + 2 children) and a <strong>[Demo] Friday Social</strong> circle, sharing one member.</p>
      <p class="text-[11px] text-gray-400 mt-2">
        Clear deletes only what this seeder created — IDs are remembered in your browser, so it
        won't touch coaches/items you set up by hand.
      </p>

      <div v-if="result" class="mt-6 bg-white rounded-xl border border-emerald-200 p-5">
        <p class="text-sm font-semibold text-emerald-700 mb-3">Done — try these:</p>
        <ul class="text-sm space-y-2">
          <li v-for="r in result" :key="r.url">
            <NuxtLink :to="r.url" class="text-primary underline font-medium">{{ r.label }}</NuxtLink>
            <span v-if="r.note" class="text-gray-400 ml-2 text-xs">— {{ r.note }}</span>
          </li>
        </ul>
        <p class="text-xs text-gray-400 mt-4">Public booker: <code class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">/book?org={{ orgId }}</code></p>
      </div>

      <div v-if="cleared" class="mt-6 bg-white rounded-xl border border-amber-200 p-5 text-sm text-amber-700">
        Cleared <span class="font-semibold">{{ cleared.activities }}</span> activit{{ cleared.activities === 1 ? 'y' : 'ies' }}
        and <span class="font-semibold">{{ cleared.bookables }}</span> bookable{{ cleared.bookables === 1 ? '' : 's' }}.
      </div>

      <div v-if="error" class="mt-6 bg-white rounded-xl border border-red-200 p-5 text-sm text-red-600">
        {{ error }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()

const seeding = ref(false)
const clearing = ref(false)
const result = ref<{ url: string; label: string; note?: string }[] | null>(null)
const error = ref<string | null>(null)
const cleared = ref<{ activities: number; bookables: number } | null>(null)

// Demo IDs are tracked in localStorage keyed by org so Clear doesn't
// touch real data. Trade-off: only works on the same browser that ran
// the seed. Acceptable for a dev page.
const STORAGE_KEY = computed(() => `fm-demo-seed:${orgId.value ?? 'unknown'}`)

interface SeedRecord { activityIds: string[]; bookableIds: string[] }
function readSeedRecord(): SeedRecord {
  if (typeof window === 'undefined') return { activityIds: [], bookableIds: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY.value)
    if (!raw) return { activityIds: [], bookableIds: [] }
    const parsed = JSON.parse(raw)
    return {
      activityIds: Array.isArray(parsed.activityIds) ? parsed.activityIds : [],
      bookableIds: Array.isArray(parsed.bookableIds) ? parsed.bookableIds : [],
    }
  } catch {
    return { activityIds: [], bookableIds: [] }
  }
}
function writeSeedRecord(rec: SeedRecord) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY.value, JSON.stringify(rec))
}

async function clearDemo() {
  if (!orgId.value) { error.value = 'No org context — log in first.'; return }
  if (!confirm('Delete all demo data: seeded activities/bookables (this browser) + every [Demo] family/circle + demo people? Cannot be undone.')) return
  clearing.value = true
  error.value = null
  result.value = null
  cleared.value = null
  try {
    // Demo families/circles + demo people (circle_members cascade on delete).
    await (db.from as any)('circles').delete().eq('org_id', orgId.value).ilike('name', '[Demo]%')
    await (db.from as any)('persons').delete().eq('org_id', orgId.value).ilike('email', '%@demo.local')
    const rec = readSeedRecord()
    // Activities first — modes/resources/required_items/activity_bookables
    // cascade away via `on delete cascade`.
    if (rec.activityIds.length) {
      await (db.from as any)('activities').delete().in('id', rec.activityIds)
    }
    // Bookables — children before parents to avoid orphans if a parent
    // delete happens to fail mid-flight. Look up parent_id so we can
    // sort kids first, then parents.
    let kidCount = 0
    if (rec.bookableIds.length) {
      const { data: bks } = await (db.from as any)('bookables')
        .select('id, parent_id')
        .in('id', rec.bookableIds)
      const kids = (bks ?? []).filter((r: any) => r.parent_id).map((r: any) => r.id)
      kidCount = kids.length
      if (kids.length) await (db.from as any)('bookables').delete().in('id', kids)
      const remaining = rec.bookableIds.filter((id: string) => !kids.includes(id))
      if (remaining.length) await (db.from as any)('bookables').delete().in('id', remaining)
    }
    cleared.value = { activities: rec.activityIds.length, bookables: rec.bookableIds.length }
    writeSeedRecord({ activityIds: [], bookableIds: [] })
  } catch (e: any) {
    console.error('Clear failed', e)
    error.value = e?.message ?? 'Unknown error'
  } finally {
    clearing.value = false
  }
}

// ── Families & Circles demo (migration 170) ──
const seedingLinks = ref(false)
const linksResult = ref<string | null>(null)
async function seedPeopleLinks() {
  if (!orgId.value) { error.value = 'No org context — log in first.'; return }
  seedingLinks.value = true
  linksResult.value = null
  try {
    // idempotent person upsert by email (demo domain so Clear can target them)
    const demoPeople = [
      { first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@demo.local' },
      { first_name: 'John', last_name: 'Smith', email: 'john.smith@demo.local' },
      { first_name: 'Emma', last_name: 'Smith', email: 'emma.smith@demo.local', dob: '2013-05-04' },
      { first_name: 'Liam', last_name: 'Smith', email: 'liam.smith@demo.local', dob: '2015-09-12' },
      { first_name: 'Alex', last_name: 'Rivera', email: 'alex.rivera@demo.local' },
      { first_name: 'Sam', last_name: 'Okoro', email: 'sam.okoro@demo.local' },
    ]
    const ids: Record<string, string> = {}
    for (const p of demoPeople) {
      const { data: existing } = await (db.from as any)('persons').select('id').eq('org_id', orgId.value).ilike('email', p.email).maybeSingle()
      if (existing?.id) { ids[p.email] = existing.id; continue }
      const { data: ins } = await (db.from as any)('persons').insert({ org_id: orgId.value, ...p }).select('id').single()
      ids[p.email] = ins.id
    }
    // Family
    const { data: fam } = await (db.from as any)('circles').insert({ org_id: orgId.value, name: '[Demo] Smith Family', kind: 'family' }).select('id').single()
    const famRows = [
      { person_id: ids['jane.smith@demo.local'], role: 'guardian', relationship: 'Mum', contact_type: 'primary', is_primary: true, receives_comms: true },
      { person_id: ids['john.smith@demo.local'], role: 'guardian', relationship: 'Dad', contact_type: 'standard', receives_comms: true },
      { person_id: ids['emma.smith@demo.local'], role: 'dependent' },
      { person_id: ids['liam.smith@demo.local'], role: 'dependent' },
    ].map((r, i) => ({ circle_id: fam.id, sort_order: i, ...r }))
    await (db.from as any)('circle_members').insert(famRows)
    // Friends circle — Jane is also here (multi-circle membership)
    const { data: circ } = await (db.from as any)('circles').insert({ org_id: orgId.value, name: '[Demo] Friday Social', kind: 'circle' }).select('id').single()
    const circRows = [
      { person_id: ids['jane.smith@demo.local'], role: 'member' },
      { person_id: ids['alex.rivera@demo.local'], role: 'member' },
      { person_id: ids['sam.okoro@demo.local'], role: 'member' },
    ].map((r, i) => ({ circle_id: circ.id, sort_order: i, ...r }))
    await (db.from as any)('circle_members').insert(circRows)
    linksResult.value = 'Created Smith Family + Friday Social (Jane is in both).'
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to seed families & circles'
  } finally {
    seedingLinks.value = false
  }
}

async function seed() {
  if (!orgId.value) { error.value = 'No org context — log in first.'; return }
  seeding.value = true
  result.value = null
  error.value = null
  try {
    // 0. Default season range — start = 2 weeks ago, end = 4 months from today.
    await seedSeasonRange()

    // 1. Equipment + venues that the coach modes will reference.
    const equip = await seedEquipment()
    const cricketNets = await seedCricketNets()
    const tennisCourts = await seedTennisCourts()

    // 2. Item rentals (existing).
    const projector = await seedProjector()
    const lockers = await seedLockers()

    // 3. Coaches — Sarah's modes use the cricket nets + bowling machine,
    //    Tom's modes use the tennis courts.
    const sarah = await seedCoachSarah(cricketNets, equip.bowlingMachineId)
    const tom = await seedCoachTom(tennisCourts)

    // 4. Plain venue activity — Tennis Court Hire — so the booker's
    //    "Tennis" category surfaces both Tom and the venue rental.
    const tennisHire = await seedTennisCourtHire(tennisCourts)

    result.value = [
      { url: `/bookables/${sarah.bookableId}?tab=offerings`, label: 'Coach Sarah\'s "What I offer"', note: 'cricket coach' },
      { url: `/bookables/${tom.bookableId}?tab=offerings`,   label: 'Coach Tom\'s "What I offer"',   note: 'tennis coach' },
      { url: `/bookings/new?activityId=${sarah.activityId}`, label: 'Book Coach Sarah',              note: 'auto-resolves a net + reserves a bowling machine' },
      { url: `/bookings/new?activityId=${tom.activityId}`,   label: 'Book Coach Tom',                note: 'auto-resolves a tennis court' },
      { url: `/bookings/new?activityId=${tennisHire}`,       label: 'Tennis Court Hire',             note: 'plain venue rental' },
      { url: `/bookings/new?activityId=${projector}`,        label: 'Projector hire',                note: 'item flow' },
      { url: `/bookings/new?activityId=${lockers}`,          label: 'Locker rental',                 note: 'item flow with weekly rolling rate' },
      { url: `/bookings/new`, label: 'Booker home',                                                  note: 'see the "By service" category cards' },
    ]
  } catch (e: any) {
    console.error('Seed failed', e)
    error.value = e?.message ?? 'Unknown error'
  } finally {
    seeding.value = false
  }
}

// ── Default season range on the org ──────────────────────────────────────
async function seedSeasonRange() {
  const today = new Date()
  const start = new Date(today); start.setDate(start.getDate() - 14)
  const end = new Date(today); end.setMonth(end.getMonth() + 4)
  const iso = (d: Date) => {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  await (db.from as any)('organisations')
    .update({ season_start: iso(start), season_end: iso(end) })
    .eq('id', orgId.value)
}

// ── Equipment inventory (ITEM bookables) ─────────────────────────────────
async function seedEquipment() {
  const rows = [
    { name: 'Bowling Machine', max_concurrent: 2 },
    { name: 'Footballs',       max_concurrent: 20 },
    { name: 'Cones',           max_concurrent: 50 },
  ]
  const ids: Record<string, string> = {}
  for (const r of rows) {
    const { data } = await (db.from as any)('bookables').insert({
      org_id: orgId.value,
      name: r.name,
      type: 'ITEM',
      status: 'ACTIVE',
      max_concurrent: r.max_concurrent,
      is_public: false,
    }).select('id').single()
    if (data?.id) ids[r.name] = data.id
  }
  return {
    bowlingMachineId: ids['Bowling Machine'],
    footballsId:      ids['Footballs'],
    conesId:          ids['Cones'],
  }
}

// ── Cricket nets (3 venue children under one parent) ─────────────────────
async function seedCricketNets(): Promise<string[]> {
  const { data: parent } = await (db.from as any)('bookables').insert({
    org_id: orgId.value,
    name: 'Cricket Nets',
    type: 'VENUE',
    status: 'ACTIVE',
    max_concurrent: 3,
    is_public: true,
    allow_sub_venues: true,
  }).select('id').single()

  const ids: string[] = []
  for (let i = 1; i <= 3; i++) {
    const { data } = await (db.from as any)('bookables').insert({
      org_id: orgId.value,
      name: `Net ${i}`,
      type: 'VENUE',
      status: 'ACTIVE',
      max_concurrent: 1,
      parent_id: parent.id,
      is_public: true,
    }).select('id').single()
    if (data?.id) ids.push(data.id)
  }
  return ids
}

// ── Tennis courts (3 venue children under one parent) ────────────────────
async function seedTennisCourts(): Promise<string[]> {
  const { data: parent } = await (db.from as any)('bookables').insert({
    org_id: orgId.value,
    name: 'Tennis Courts',
    type: 'VENUE',
    status: 'ACTIVE',
    max_concurrent: 3,
    is_public: true,
    allow_sub_venues: true,
  }).select('id').single()

  const ids: string[] = []
  for (let i = 1; i <= 3; i++) {
    const { data } = await (db.from as any)('bookables').insert({
      org_id: orgId.value,
      name: `Court ${i}`,
      type: 'VENUE',
      status: 'ACTIVE',
      max_concurrent: 1,
      parent_id: parent.id,
      is_public: true,
    }).select('id').single()
    if (data?.id) ids.push(data.id)
  }
  return ids
}

// ── Coach Sarah (cricket) ────────────────────────────────────────────────
async function seedCoachSarah(cricketNetIds: string[], bowlingMachineId: string) {
  // PERSON bookable.
  const { data: bk } = await (db.from as any)('bookables').insert({
    org_id: orgId.value,
    name: 'Sarah Wright',
    type: 'PERSON',
    status: 'ACTIVE',
    max_concurrent: 1,
    is_public: true,
    custom_fields: { email: 'sarah@demo.club', phone: '+64 21 555 0001' },
  }).select('id').single()
  const bookableId = bk.id as string

  // Owning activity (one per coach — name = coach name).
  const { data: act } = await (db.from as any)('activities').insert({
    org_id: orgId.value,
    name: 'Sarah Wright',
    status: 'ACTIVE',
    bookings_enabled: true,
    booking_flow: 'wizard',
    require_mode: true,
    staff_bookable_id: bookableId,
    color: '#0EA5E9',
    icon: 'pi-user',
  }).select('id').single()
  const activityId = act.id as string

  await (db.from as any)('activity_bookables').insert({
    activity_id: activityId,
    bookable_id: bookableId,
  })

  // Two modes: a bowling-machine session + a 1-on-1 lesson. Both tagged
  // "Cricket" so the booker's "By service" card surfaces them together.
  const modeRows = [
    { name: 'Net session (with machine)', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 80,  category: 'Cricket', sort_order: 0 },
    { name: '1-on-1 coaching',            period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 100, category: 'Cricket', sort_order: 1 },
  ]
  const { data: createdModes } = await (db.from as any)('activity_modes')
    .insert(modeRows.map(r => ({ ...r, activity_id: activityId })))
    .select('id, name')
  const machineMode = (createdModes ?? []).find((m: any) => m.name === 'Net session (with machine)')
  const oneOnOneMode = (createdModes ?? []).find((m: any) => m.name === '1-on-1 coaching')

  // Both modes need a cricket net (system picks first free).
  const resourceRows: any[] = []
  for (const m of createdModes ?? []) {
    cricketNetIds.forEach((bid, i) => {
      resourceRows.push({ mode_id: m.id, bookable_id: bid, sort_order: i })
    })
  }
  if (resourceRows.length) await (db.from as any)('activity_mode_resources').insert(resourceRows)

  // Net session also auto-reserves 1 bowling machine — the customer
  // never picks it; it shows as a locked row in the Equipment section.
  if (machineMode?.id && bowlingMachineId) {
    await (db.from as any)('activity_mode_required_items').insert({
      mode_id: machineMode.id,
      bookable_id: bowlingMachineId,
      quantity: 1,
      sort_order: 0,
    })
  }
  // Avoid lint by referencing oneOnOneMode (kept for clarity / future tweaks).
  void oneOnOneMode

  return { bookableId, activityId }
}

// ── Coach Tom (tennis) ───────────────────────────────────────────────────
async function seedCoachTom(tennisCourtIds: string[]) {
  const { data: bk } = await (db.from as any)('bookables').insert({
    org_id: orgId.value,
    name: 'Tom Singh',
    type: 'PERSON',
    status: 'ACTIVE',
    max_concurrent: 1,
    is_public: true,
    custom_fields: { email: 'tom@demo.club', phone: '+64 21 555 0002' },
  }).select('id').single()
  const bookableId = bk.id as string

  const { data: act } = await (db.from as any)('activities').insert({
    org_id: orgId.value,
    name: 'Tom Singh',
    status: 'ACTIVE',
    bookings_enabled: true,
    booking_flow: 'wizard',
    require_mode: true,
    staff_bookable_id: bookableId,
    color: '#10B981',
    icon: 'pi-user',
  }).select('id').single()
  const activityId = act.id as string

  await (db.from as any)('activity_bookables').insert({
    activity_id: activityId,
    bookable_id: bookableId,
  })

  const modeRows = [
    { name: '30-min lesson', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 60,  category: 'Tennis', sort_order: 0 },
    { name: '60-min lesson', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 100, category: 'Tennis', sort_order: 1 },
  ]
  const { data: createdModes } = await (db.from as any)('activity_modes')
    .insert(modeRows.map(r => ({ ...r, activity_id: activityId })))
    .select('id')

  const resourceRows: any[] = []
  for (const m of createdModes ?? []) {
    tennisCourtIds.forEach((bid, i) => {
      resourceRows.push({ mode_id: m.id, bookable_id: bid, sort_order: i })
    })
  }
  if (resourceRows.length) await (db.from as any)('activity_mode_resources').insert(resourceRows)

  return { bookableId, activityId }
}

// ── Tennis Court Hire (plain venue rental) ───────────────────────────────
async function seedTennisCourtHire(tennisCourtIds: string[]): Promise<string> {
  const { data: act } = await (db.from as any)('activities').insert({
    org_id: orgId.value,
    name: 'Tennis Court Hire',
    status: 'ACTIVE',
    bookings_enabled: true,
    booking_flow: 'wizard',
    require_mode: true,
    color: '#10B981',
    icon: 'pi-bolt',
  }).select('id').single()
  const activityId = act.id as string

  // Link each court to the activity so the wizard's Resource step can
  // surface them as bookable options.
  if (tennisCourtIds.length) {
    await (db.from as any)('activity_bookables').insert(
      tennisCourtIds.map(bid => ({ activity_id: activityId, bookable_id: bid })),
    )
  }

  await (db.from as any)('activity_modes').insert([
    { activity_id: activityId, name: 'Hourly hire',  period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 25, category: 'Tennis', sort_order: 0 },
  ])

  return activityId
}

// ── Projector hire (item rental) ─────────────────────────────────────────
async function seedProjector(): Promise<string> {
  const { data: act } = await (db.from as any)('activities').insert({
    org_id: orgId.value,
    name: 'Projector hire',
    status: 'ACTIVE',
    bookings_enabled: true,
    booking_flow: 'item',
    require_mode: true,
    assignment_mode: 'system',
    area_name_singular: 'Projector',
    area_name_plural: 'Projectors',
    color: '#0EA5E9',
    icon: 'pi-video',
  }).select('id').single()
  const activityId = act.id as string

  const { data: bk } = await (db.from as any)('bookables').insert({
    org_id: orgId.value,
    name: 'Projector',
    type: 'ITEM',
    status: 'ACTIVE',
    max_concurrent: 1,
    is_public: true,
  }).select('id').single()

  await (db.from as any)('activity_bookables').insert({ activity_id: activityId, bookable_id: bk.id })

  await (db.from as any)('activity_modes').insert([
    { activity_id: activityId, name: 'Hourly', period_unit: 'hour', period_count: 1, term_type: 'fixed', period_price: 10, category: 'Equipment hire', sort_order: 0 },
    { activity_id: activityId, name: 'Daily',  period_unit: 'day',  period_count: 1, term_type: 'fixed', period_price: 40, category: 'Equipment hire', sort_order: 1 },
  ])

  return activityId
}

// ── Locker rental (item rental) ──────────────────────────────────────────
async function seedLockers(): Promise<string> {
  const { data: act } = await (db.from as any)('activities').insert({
    org_id: orgId.value,
    name: 'Locker rental',
    status: 'ACTIVE',
    bookings_enabled: true,
    booking_flow: 'item',
    require_mode: true,
    assignment_mode: 'either',
    area_name_singular: 'Locker',
    area_name_plural: 'Lockers',
    color: '#10B981',
    icon: 'pi-lock',
  }).select('id').single()
  const activityId = act.id as string

  const { data: parent } = await (db.from as any)('bookables').insert({
    org_id: orgId.value,
    name: 'Locker Room',
    type: 'VENUE',
    status: 'ACTIVE',
    max_concurrent: 10,
    is_public: true,
    allow_sub_venues: true,
  }).select('id').single()

  const childRows = Array.from({ length: 10 }, (_, i) => ({
    org_id: orgId.value,
    name: `Locker ${i + 1}`,
    type: 'ITEM',
    parent_id: parent.id,
    status: 'ACTIVE',
    max_concurrent: 1,
    is_public: true,
  }))
  await (db.from as any)('bookables').insert(childRows)

  await (db.from as any)('activity_bookables').insert({ activity_id: activityId, bookable_id: parent.id })

  await (db.from as any)('activity_modes').insert([
    { activity_id: activityId, name: 'Weekly',    period_unit: 'week',  period_count: 1, term_type: 'recurring', period_price: 10,  category: 'Storage', sort_order: 0 },
    { activity_id: activityId, name: '6-Monthly', period_unit: 'month', period_count: 6, term_type: 'fixed',     period_price: 100, category: 'Storage', sort_order: 1 },
  ])

  return activityId
}
</script>
