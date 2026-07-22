<!--
  PeopleSelector — the app's REUSABLE "pick people" tool.

  One question ("who?"), three ways to answer it:
    • SEARCH   — type a name and get people, type a class name and get classes.
    • FILTER   — describe the people you want (girls under 12 in the Rec programme)
                 and get the actual LIST back, with Add / Add all N.
    • BROWSE   — the class tree, by programme, add a whole class or a whole code.

  It knows nothing about events. It emits intents (add-person / add-people /
  toggle-group / toggle-code) and renders state the host passes back in
  (invitedPersonIds / addedGroupIds), so the SAME selector serves event invitees,
  comms recipients, group rosters, anything that needs to choose people.

  NOTE the filter used to be a lie: <EventInviteeManager> had a "Filter" dialog
  whose criteria were never applied to anything — it only lit up a count badge.
  This one actually queries persons.
-->
<script setup lang="ts">
const props = withDefaults(defineProps<{
  /** People already chosen by the host — shown as "Invited"/"Added", not addable twice. */
  invitedPersonIds?: string[]
  /** Classes already added — drives the Added state on the tree. */
  addedGroupIds?: string[]
  /** In-flight ids, so the host can show a spinner on the row it's writing. */
  busyPersonId?: string | null
  busyGroupId?: string | null
  /** Wording for the "already chosen" state ("Invited" on an event, "Added" elsewhere). */
  addedLabel?: string
  /** When the current org is a governing body, reveals an "Internal | Clubs" scope
   *  tab so it can invite whole affiliated clubs — not just its own people. The host
   *  decides this (it knows the org level); the selector stays context-free. */
  showClubs?: boolean
  /** Clubs already chosen by the host — so a club row flashes on re-add like a person. */
  addedOrgIds?: string[]
}>(), {
  invitedPersonIds: () => [],
  addedGroupIds: () => [],
  busyPersonId: null,
  busyGroupId: null,
  addedLabel: 'Added',
  showClubs: false,
  addedOrgIds: () => [],
})

// `who` mirrors the legacy mailer's split Add button (Add ▾ → Members / Staff):
// adding a class usually means everyone in it, but sometimes you want only the
// members, or only the coaches.
export type Who = 'all' | 'members' | 'staff'

const emit = defineEmits<{
  (e: 'add-person', person: any): void
  (e: 'add-people', people: any[]): void
  (e: 'toggle-group', groupId: string, who: Who): void
  (e: 'toggle-code', groupIds: string[], adding: boolean, who: Who): void
  /** Clicked someone already chosen — the host highlights them where they are. */
  (e: 'reveal-person', personId: string): void
  /** Add a whole affiliated club (from the Clubs tab). Host owns persistence. */
  (e: 'add-org', org: { id: string; name: string; sport?: string; bodyName?: string }): void
  /** Clicked a club already chosen — the host flashes it where it is (like reveal-person). */
  (e: 'reveal-org', orgId: string): void
}>()

const peopleApi = usePeopleApi()
const groupsApi = useGroupsApi()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const gc = useGroupCodes()
const { affiliatedClubs } = useAffiliations()
const peopleLinks = usePeopleLinks()

const isChosen = (id: string) => props.invitedPersonIds.includes(id)

// Family circles (loaded once) — used to offer a chosen person's PARENTS/guardians on
// the split-button caret. A person's guardians = the `guardian` members of every family
// circle they belong to as a `dependent`.
const circles = ref<any[]>([])
function parentsOf(personId: string): any[] {
  const out: any[] = []
  const seen = new Set<string>()
  for (const c of circles.value) {
    if (c.kind !== 'family') continue
    if (!c.members?.some((m: any) => m.person_id === personId && m.role === 'dependent')) continue
    for (const m of c.members) {
      if (m.role === 'guardian' && m.person && !seen.has(m.person_id)) {
        seen.add(m.person_id)
        out.push({ id: m.person.id, first_name: m.person.first_name, last_name: m.person.last_name, email: m.person.email, gender: m.person.gender ?? null, dob: m.person.dob ?? null })
      }
    }
  }
  return out
}
// Caret menu: "Add {parent}" per guardian (re-adding an already-chosen one flashes them).
function parentsMenu(p: any) {
  return parentsOf(p.id).map(par => ({
    label: `Add ${((par.first_name || '') + ' ' + (par.last_name || '')).trim() || 'parent'}`,
    icon: isChosen(par.id) ? 'pi pi-check' : 'pi pi-user-plus',
    command: () => addOrReveal(par),
  }))
}

// ── SCOPE: Internal (this org's people/classes) vs Clubs (the NSO's affiliated
// clubs). The tab only exists when the host passes showClubs — a plain club never
// sees it, and the Internal panel is verbatim what the selector has always shown. ──
const activeTab = ref<'internal' | 'clubs'>('internal')
const clubGroups = ref<{ label: string; clubs: any[] }[]>([])
const clubsFlat = ref<any[]>([])
const clubsLoading = ref(false)
let clubsLoaded = false

async function loadClubs() {
  if (clubsLoaded || !props.showClubs) return
  clubsLoading.value = true
  try {
    const { flat, groups } = await affiliatedClubs()   // approved affiliations across the body's subtree
    clubsFlat.value = flat
    clubGroups.value = groups
    clubsLoaded = true
  } finally {
    clubsLoading.value = false
  }
}

const isOrgChosen = (id: string) => props.addedOrgIds.includes(id)

// Re-adding a club already chosen flashes it where it is (same catalogue rule as
// the people list) instead of doing nothing.
function addOrRevealOrg(c: any) {
  if (isOrgChosen(c.id)) emit('reveal-org', c.id)
  else emit('add-org', { id: c.id, name: c.name, sport: c.sport, bodyName: c.bodyName })
}

// The same search box filters the club list by name, keeping the body groupings.
const clubSections = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return clubGroups.value
  return clubGroups.value
    .map(g => ({ label: g.label, clubs: g.clubs.filter((c: any) => (c.name || '').toLowerCase().includes(q)) }))
    .filter(g => g.clubs.length)
})

// The seam returns the whole people directory (camelCase); search + filter run
// client-side over it (per-club counts are bounded). Loaded once, mapped to the
// snake_case shape the rest of this component reads.
let allPersonsCache: any[] | null = null
async function allPersons(): Promise<any[]> {
  if (!allPersonsCache) {
    const ppl = await peopleApi.list(orgId.value)
    allPersonsCache = ppl.map(p => ({
      id: p.id, first_name: p.firstName, last_name: p.lastName, email: p.email,
      gender: p.gender, dob: p.dob, membership_type: p.membershipType,
    }))
  }
  return allPersonsCache
}

// ── ONE search box feeds both halves ──────────────────────────────────────
// The class tree filters locally; people are fetched. Same query, so you never
// have to say which KIND of thing you're hunting before you hunt for it.
const search = ref('')
const personResults = ref<any[]>([])
const personLoading = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  if (!search.value.trim()) { personResults.value = []; return }
  searchTimer = setTimeout(searchPeople, 250)
}

async function searchPeople() {
  personLoading.value = true
  const q = search.value.trim().toLowerCase()

  // People type FULL names. Matching the whole string against first_name OR
  // last_name individually finds nobody for "sam ng" — no single column holds it.
  // So a multi-word query also matches first+last as a pair (either way round).
  const parts = q.split(/\s+/).filter(Boolean)
  const people = await allPersons()
  const match = (p: any) => {
    const fn = (p.first_name || '').toLowerCase(), ln = (p.last_name || '').toLowerCase(), em = (p.email || '').toLowerCase()
    if (fn.includes(q) || ln.includes(q) || em.includes(q)) return true
    if (parts.length > 1) {
      const a = parts[0], b = parts.slice(1).join(' ')
      if (fn.includes(a) && ln.includes(b)) return true
      if (fn.includes(b) && ln.includes(a)) return true
    }
    return false
  }
  personResults.value = people
    .filter(match)
    .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
    .slice(0, 20)
  personLoading.value = false
}

// ── FILTER: describe the people, get the people ───────────────────────────
const filterOpen = ref(false)
const filter = reactive({
  genders: [] as string[],
  ageMin: null as number | null,
  ageMax: null as number | null,
  membershipTypes: [] as string[],
  groupIds: [] as string[],     // in any of these classes
})

const GENDERS = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Non-binary', value: 'NON_BINARY' },
  { label: 'Unspecified', value: 'UNSPECIFIED' },
]
const MEMBERSHIPS = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Non-active', value: 'NON_ACTIVE' },
  { label: 'Previous', value: 'PREVIOUS' },
  { label: 'Junior', value: 'JUNIOR' },
  { label: 'Social', value: 'SOCIAL' },
]
const AGE_PRESETS = [
  { label: 'Under 12', min: 0, max: 11 },
  { label: 'Under 18', min: 0, max: 17 },
  { label: '18–25', min: 18, max: 25 },
  { label: '26–40', min: 26, max: 40 },
  { label: '40+', min: 40, max: 120 },
]

const filterCount = computed(() =>
  filter.genders.length + filter.membershipTypes.length + filter.groupIds.length +
  (filter.ageMin !== null || filter.ageMax !== null ? 1 : 0))

const matches = ref<any[]>([])
const matching = ref(false)
const ran = ref(false)   // a run with zero results is different from "not run yet"

function toggleIn(list: string[], v: string) {
  const i = list.indexOf(v)
  i >= 0 ? list.splice(i, 1) : list.push(v)
}

function clearFilter() {
  filter.genders = []
  filter.membershipTypes = []
  filter.groupIds = []
  filter.ageMin = null
  filter.ageMax = null
  matches.value = []
  ran.value = false
}

// Age → date-of-birth window. Someone aged 11 was born between (today − 12y + 1d)
// and (today − 11y): the MAX age sets the EARLIEST birth date, and vice versa.
function dobRange(min: number | null, max: number | null) {
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const from = max !== null
    ? iso(new Date(today.getFullYear() - max - 1, today.getMonth(), today.getDate() + 1))
    : null
  const to = min !== null
    ? iso(new Date(today.getFullYear() - min, today.getMonth(), today.getDate()))
    : null
  return { from, to }
}

// Close the dialog and show the answer — the results are what you asked for, so
// they shouldn't be hidden behind the question.
function applyFilter() {
  filterOpen.value = false
  runFilter()
}

async function runFilter() {
  matching.value = true
  let people = await allPersons()

  if (filter.genders.length) people = people.filter(p => filter.genders.includes(p.gender))
  if (filter.membershipTypes.length) people = people.filter(p => filter.membershipTypes.includes(p.membership_type))

  const { from, to } = dobRange(filter.ageMin, filter.ageMax)
  // An age filter implies a known birth date — someone with no dob can't be shown
  // to match "under 12", so they're excluded rather than silently included. dob is
  // compared on its date prefix, so a full ISO timestamp still sorts correctly.
  if (from) people = people.filter(p => p.dob && (p.dob as string).slice(0, 10) >= from)
  if (to) people = people.filter(p => p.dob && (p.dob as string).slice(0, 10) <= to)

  // "In any of these classes" — resolve to person ids first, then constrain.
  if (filter.groupIds.length) {
    const per = await Promise.all(filter.groupIds.map(g => groupsApi.memberships(g)))
    const ids = new Set(per.flat().map((m: any) => m.personId))
    if (!ids.size) { matches.value = []; ran.value = true; matching.value = false; return }
    people = people.filter(p => ids.has(p.id))
  }

  matches.value = people
    .slice()
    .sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))
    .slice(0, 500)
  ran.value = true
  matching.value = false
}

// Everyone matched who isn't already chosen — what "Add all" actually adds.
const addableMatches = computed(() => matches.value.filter(p => !isChosen(p.id)))

// Legacy mailer rule: adding someone already chosen is NOT an error and NOT a
// no-op — it flashes them where they already are (their chip goes green and
// fades back). Bulk-adding overlapping sets is normal; it should feel safe.
function addOrReveal(p: any) {
  if (isChosen(p.id)) emit('reveal-person', p.id)
  else emit('add-person', p)
}

function addAllMatches() {
  if (addableMatches.value.length) emit('add-people', addableMatches.value)
}

function ageOf(dob: string | null) {
  if (!dob) return null
  const d = new Date(dob), n = new Date()
  let a = n.getFullYear() - d.getFullYear()
  const m = n.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--
  return a
}

// ── BROWSE: the class tree, by programme ──────────────────────────────────
const groupsLoading = ref(false)
const allGroups = ref<any[]>([])
const allCodes = ref<any[]>([])
const expanded = reactive<Record<string, boolean>>({})

// Term filter — classes exist per term (the same class runs each term), so the browse
// tree can show duplicates ("Kindergym" × 2). A term selector scopes it to one term.
const tm = useTermsMemberships()
const terms = ref<any[]>([])
const termId = ref<string | null>(null)   // null = all terms
const codesById = computed(() => Object.fromEntries(allCodes.value.map((c: any) => [c.id, c])))
const termOptions = computed(() => [{ id: null, name: 'All terms' }, ...terms.value])

async function loadGroups() {
  groupsLoading.value = true
  const [codes, groups, termList] = await Promise.all([
    gc.loadCodes(),
    groupsApi.list(orgId.value),
    tm.loadTerms(orgId.value).catch(() => [] as any[]),
  ])
  allCodes.value = codes ?? []
  terms.value = termList ?? []
  // Default to the current term (running → next → last-finished) — the global rule.
  termId.value = tm.currentTermId(terms.value)
  allGroups.value = groups
    .filter((g: any) => !isMembershipGroup(g))  // memberships aren't classes
    .map((g: any) => ({ id: g.id, name: g.name, color: g.color, code_id: g.codeId, term_id: g.termId, sort_order: g.sortOrder, kind: g.kind }))
  groupsLoading.value = false
}

interface CodeSection { id: string; name: string; color: string | null; depth: number; groups: any[] }

const codeSections = computed<CodeSection[]>(() => {
  const q = search.value.trim().toLowerCase()
  const hit = (g: any) => (!q || g.name.toLowerCase().includes(q))
    && (!termId.value || gc.effectiveTermId(g, codesById.value) === termId.value)

  const byCode: Record<string, any[]> = {}
  for (const g of allGroups.value) {
    if (!hit(g)) continue
    ;(byCode[g.code_id ?? '__none'] ??= []).push(g)
  }
  const byParent: Record<string, any[]> = {}
  for (const c of [...allCodes.value].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))) {
    (byParent[c.parent_id ?? '__root'] ??= []).push(c)
  }

  const out: CodeSection[] = []
  const walk = (parent: string, depth: number) => {
    for (const c of byParent[parent] ?? []) {
      const groups = byCode[c.id] ?? []
      const before = out.length
      out.push({ id: c.id, name: c.name, color: c.color, depth, groups })
      walk(c.id, depth + 1)
      if (!groups.length && out.length === before + 1) out.pop()   // empty branch
    }
  }
  walk('__root', 0)

  const ungrouped = byCode['__none'] ?? []
  if (ungrouped.length) out.push({ id: '__none', name: 'Ungrouped', color: null, depth: 0, groups: ungrouped })
  return out
})

// Every class under a code, including its sub-codes.
function groupsUnderCode(codeId: string): any[] {
  if (codeId === '__none') return allGroups.value.filter(g => !g.code_id)
  const kids = allCodes.value.filter(c => c.parent_id === codeId).map(c => c.id)
  return [
    ...allGroups.value.filter(g => g.code_id === codeId),
    ...kids.flatMap(k => groupsUnderCode(k)),
  ]
}
function codeFullyAdded(codeId: string) {
  const gs = groupsUnderCode(codeId)
  return gs.length > 0 && gs.every(g => props.addedGroupIds.includes(g.id))
}
function toggleWholeCode(codeId: string) {
  const gs = groupsUnderCode(codeId)
  emit('toggle-code', gs.map(g => g.id), !codeFullyAdded(codeId), 'all')
}

// The Add split-button's extra options (the caret), lifted from the legacy mailer.
function addMenu(onPick: (who: Who) => void) {
  return [
    { label: `${t('member', true)} only`, icon: 'pi pi-user', command: () => onPick('members') },
    { label: 'Staff only', icon: 'pi pi-shield', command: () => onPick('staff') },
  ]
}
function groupMenu(groupId: string) {
  return addMenu(who => emit('toggle-group', groupId, who))
}
function codeMenu(codeId: string) {
  return addMenu(who => emit('toggle-code', groupsUnderCode(codeId).map(g => g.id), true, who))
}

// The class MultiSelect inside the filter, indented by code like everywhere else.
const groupOptions = computed(() =>
  codeSections.value.flatMap(s => s.groups.map(g => ({ label: g.name, value: g.id, code: s.name }))))

onMounted(() => {
  loadGroups()
  if (props.showClubs) loadClubs()
  peopleLinks.loadCircles().then(c => { circles.value = c }).catch(() => { /* parents caret just stays empty */ })
})
// Load clubs if the host flips showClubs on after mount, and (defensively) when the
// user opens the Clubs tab — clubsLoaded guards against a double fetch.
watch(() => props.showClubs, v => { if (v) loadClubs() })
watch(activeTab, tab => { if (tab === 'clubs') loadClubs() })
defineExpose({ reloadGroups: loadGroups })
</script>

<template>
  <div class="space-y-3">
    <!-- Scope tabs — only for a governing org (host passes showClubs). -->
    <div v-if="showClubs" class="flex border-b border-gray-200 text-sm">
      <button type="button" class="px-3 py-2 border-b-2 -mb-px whitespace-nowrap transition-colors"
        :class="activeTab === 'internal' ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'internal'">Internal</button>
      <button type="button" class="px-3 py-2 border-b-2 -mb-px whitespace-nowrap transition-colors flex items-center gap-1.5"
        :class="activeTab === 'clubs' ? 'border-primary text-primary font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="activeTab = 'clubs'">
        Clubs
        <span v-if="clubsFlat.length" class="text-[10px] font-bold px-1.5 rounded-full"
          :class="activeTab === 'clubs' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'">{{ clubsFlat.length }}</span>
      </button>
    </div>

    <!-- INTERNAL — this org's own people + classes (the selector's original body). -->
    <div v-show="!showClubs || activeTab === 'internal'" class="space-y-3">
    <!-- Term scope — classes run every term, so this narrows the tree to one term's classes -->
    <div v-if="terms.length > 1" class="flex items-center gap-2 mb-2">
      <i class="pi pi-clock text-gray-400 text-xs shrink-0" />
      <Select v-model="termId" :options="termOptions" option-label="name" option-value="id"
        placeholder="All terms" size="small" class="flex-1" />
    </div>
    <!-- Search + Filter -->
    <div class="flex gap-2">
      <IconField class="flex-1">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" :placeholder="`Search ${t('group', true, true)} or people…`"
          size="small" class="w-full" @input="onSearchInput" />
      </IconField>
      <div class="relative">
        <Button label="Filter" icon="pi pi-filter" size="small" severity="secondary" outlined
          @click="filterOpen = true" />
        <span v-if="filterCount > 0"
          class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">
          {{ filterCount }}
        </span>
      </div>
    </div>

    <!-- FILTER RESULTS — the people who match, ready to add -->
    <div v-if="ran || matching" class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
        <span class="text-xs font-bold uppercase tracking-wide text-gray-400 flex-1">
          {{ matching ? 'Finding people…' : `${matches.length} ${matches.length === 1 ? 'person' : 'people'} match` }}
        </span>
        <Button v-if="!matching && addableMatches.length"
          :label="`Add all ${addableMatches.length}`" icon="pi pi-plus" size="small" outlined
          @click="addAllMatches" />
        <button class="text-xs text-gray-400 hover:text-gray-700 underline" @click="clearFilter">Clear</button>
      </div>

      <div v-if="matching" class="py-8 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
      <div v-else-if="!matches.length" class="py-6 text-center text-sm text-gray-400">
        Nobody matches those filters.
      </div>
      <div v-else class="max-h-[280px] overflow-y-auto">
        <div v-for="p in matches" :key="p.id"
          class="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
          <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span class="text-[10px] font-bold text-primary">{{ p.first_name?.[0] }}{{ p.last_name?.[0] }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
              {{ p.first_name }} {{ p.last_name }}
              <i v-if="isChosen(p.id)" v-tooltip.top="addedLabel" class="pi pi-check-circle text-emerald-500 text-xs" />
            </p>
            <p class="text-xs text-gray-400 truncate">
              <span v-if="ageOf(p.dob) !== null">{{ ageOf(p.dob) }} yrs</span>
              <span v-if="ageOf(p.dob) !== null && p.email"> · </span>
              <span v-if="p.email">{{ p.email }}</span>
            </p>
          </div>
          <!-- A chosen person's primary shows "Added" (still clickable → flashes them
               where they already are). When they have parents/guardians the split caret
               lets you add those too; rows without parents are a plain button. -->
          <SplitButton v-if="parentsOf(p.id).length"
            :label="isChosen(p.id) ? addedLabel : 'Add'"
            :icon="busyPersonId === p.id ? 'pi pi-spin pi-spinner' : (isChosen(p.id) ? 'pi pi-check' : 'pi pi-plus')"
            size="small" :severity="isChosen(p.id) ? 'success' : 'secondary'" outlined
            :model="parentsMenu(p)" :disabled="busyPersonId === p.id"
            @click="addOrReveal(p)" />
          <Button v-else
            :label="isChosen(p.id) ? addedLabel : 'Add'"
            :icon="busyPersonId === p.id ? 'pi pi-spin pi-spinner' : (isChosen(p.id) ? 'pi pi-check' : 'pi pi-plus')"
            size="small" :severity="isChosen(p.id) ? 'success' : 'secondary'" outlined
            :disabled="busyPersonId === p.id"
            @click="addOrReveal(p)" />
        </div>
      </div>
    </div>

    <!-- SEARCH RESULTS — people matching the typed query. Only once you've typed:
         with no query the whole club isn't a sensible list. -->
    <div v-if="search.trim() && (personLoading || personResults.length)"
      class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <p class="px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400 border-b border-gray-100 bg-gray-50">People</p>
      <div v-if="personLoading" class="py-6 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
      <div v-else v-for="p in personResults" :key="p.id"
        class="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
        <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span class="text-[10px] font-bold text-primary">{{ p.first_name?.[0] }}{{ p.last_name?.[0] }}</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
            {{ p.first_name }} {{ p.last_name }}
            <i v-if="isChosen(p.id)" v-tooltip.top="addedLabel" class="pi pi-check-circle text-emerald-500 text-xs" />
          </p>
          <p v-if="p.email" class="text-xs text-gray-400 truncate">{{ p.email }}</p>
        </div>
        <SplitButton v-if="parentsOf(p.id).length"
          :label="isChosen(p.id) ? addedLabel : 'Add'"
          :icon="busyPersonId === p.id ? 'pi pi-spin pi-spinner' : (isChosen(p.id) ? 'pi pi-check' : 'pi pi-plus')"
          size="small" :severity="isChosen(p.id) ? 'success' : 'secondary'" outlined
          :model="parentsMenu(p)" :disabled="busyPersonId === p.id"
          @click="addOrReveal(p)" />
        <Button v-else
          :label="isChosen(p.id) ? addedLabel : 'Add'"
          :icon="busyPersonId === p.id ? 'pi pi-spin pi-spinner' : (isChosen(p.id) ? 'pi pi-check' : 'pi pi-plus')"
          size="small" :severity="isChosen(p.id) ? 'success' : 'secondary'" outlined
          :disabled="busyPersonId === p.id"
          @click="addOrReveal(p)" />
      </div>
    </div>

    <!-- BROWSE — classes, by programme -->
    <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div v-if="groupsLoading" class="py-8 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
      <div v-else-if="!codeSections.length" class="py-6 text-center text-sm text-gray-400">
        No {{ t('group', true, true) }} found
      </div>
      <div v-else>
        <template v-for="section in codeSections" :key="section.id">
          <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors"
            :style="{ paddingLeft: `${12 + section.depth * 16}px` }">
            <button class="w-4 h-4 flex items-center justify-center text-gray-400 shrink-0"
              @click="expanded[section.id] = expanded[section.id] === false">
              <i :class="`pi text-xs ${expanded[section.id] === false ? 'pi-chevron-right' : 'pi-chevron-down'}`" />
            </button>
            <span v-if="section.color" class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: section.color }" />
            <span class="flex-1 text-sm font-semibold text-gray-800">{{ section.name }}</span>
            <span class="text-xs text-gray-400 mr-2">{{ groupsUnderCode(section.id).length }} {{ t('group', true, true) }}</span>
            <!-- Split button, straight from the legacy mailer: primary adds everyone,
                 the caret narrows it to members or staff. The row is a reusable
                 QUERY, so it never becomes a dead "Added". -->
            <SplitButton label="Add all" icon="pi pi-plus" size="small" severity="secondary" outlined
              :model="codeMenu(section.id)"
              :disabled="!groupsUnderCode(section.id).length"
              @click="emit('toggle-code', groupsUnderCode(section.id).map(g => g.id), true, 'all')" />
          </div>

          <template v-if="expanded[section.id] !== false">
            <div v-for="group in section.groups" :key="group.id"
              class="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 bg-white hover:bg-gray-50 transition-colors"
              :style="{ paddingLeft: `${32 + section.depth * 16}px` }">
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: group.color ?? '#94a3b8' }" />
              <span class="flex-1 text-sm text-gray-700">{{ group.name }}</span>
              <SplitButton label="Add" :icon="busyGroupId === group.id ? 'pi pi-spin pi-spinner' : 'pi pi-plus'"
                size="small" severity="secondary" outlined
                :model="groupMenu(group.id)"
                :disabled="busyGroupId === group.id"
                @click="emit('toggle-group', group.id, 'all')" />
            </div>
          </template>
        </template>
      </div>
    </div>
    </div>
    <!-- /INTERNAL -->

    <!-- CLUBS — the NSO's affiliated clubs, grouped under the body that approved
         them, so the picker reads as its hierarchy. A club row is a single Add (no
         members/staff facet); rows are a catalogue — re-adding flashes, never greys. -->
    <div v-if="showClubs" v-show="activeTab === 'clubs'" class="space-y-3">
      <IconField class="w-full">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search clubs…" size="small" class="w-full" />
      </IconField>

      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div v-if="clubsLoading" class="py-8 flex justify-center"><i class="pi pi-spin pi-spinner text-gray-400" /></div>
        <div v-else-if="!clubSections.length" class="py-6 text-center text-sm text-gray-400">
          {{ search.trim() ? 'No clubs match.' : 'No affiliated clubs yet.' }}
        </div>
        <div v-else>
          <template v-for="section in clubSections" :key="section.label">
            <div class="px-3 py-2.5 border-b border-gray-100 bg-gray-50 text-sm font-semibold text-gray-800">
              {{ section.label }}
            </div>
            <div v-for="c in section.clubs" :key="c.id"
              class="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 last:border-0 bg-white hover:bg-gray-50 transition-colors">
              <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <i class="pi pi-building text-primary text-xs" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800 truncate flex items-center gap-1.5">
                  {{ c.name }}
                  <i v-if="isOrgChosen(c.id)" v-tooltip.top="addedLabel" class="pi pi-check-circle text-emerald-500 text-xs" />
                </p>
                <p v-if="c.sport" class="text-xs text-gray-400 truncate">{{ c.sport }}</p>
              </div>
              <Button label="Add" icon="pi pi-plus" size="small" severity="secondary" outlined
                @click="addOrRevealOrg(c)" />
            </div>
          </template>
        </div>
      </div>
    </div>
    <!-- /CLUBS -->

    <!-- ── Filter dialog: describe the people you want ── -->
    <Dialog v-model:visible="filterOpen" modal header="Find people" :style="{ width: '95vw', maxWidth: '520px' }">
      <div class="space-y-5">
        <!-- Term scopes which classes the "In {group}" picker offers (per-term instances),
             sharing the same termId as the top-bar selector so the two stay in sync. -->
        <div v-if="terms.length > 1">
          <p class="text-sm font-medium text-gray-800 mb-2">{{ t('term') }}</p>
          <Select v-model="termId" :options="termOptions" option-label="name" option-value="id"
            placeholder="All terms" class="w-full" />
        </div>

        <div>
          <p class="text-sm font-medium text-gray-800 mb-2">Gender</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="g in GENDERS" :key="g.value" type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              :class="filter.genders.includes(g.value)
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'"
              @click="toggleIn(filter.genders, g.value)">{{ g.label }}</button>
          </div>
        </div>

        <div>
          <p class="text-sm font-medium text-gray-800 mb-2">Age</p>
          <div class="flex flex-wrap gap-2 mb-2">
            <button v-for="p in AGE_PRESETS" :key="p.label" type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              :class="filter.ageMin === p.min && filter.ageMax === p.max
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'"
              @click="filter.ageMin = p.min; filter.ageMax = p.max">{{ p.label }}</button>
          </div>
          <div class="flex items-center gap-2">
            <InputNumber v-model="filter.ageMin" :min="0" :max="120" placeholder="From" size="small" class="flex-1" />
            <span class="text-gray-300">–</span>
            <InputNumber v-model="filter.ageMax" :min="0" :max="120" placeholder="To" size="small" class="flex-1" />
          </div>
          <p v-if="filter.ageMin !== null || filter.ageMax !== null" class="text-xs text-gray-400 mt-1.5">
            Only people with a date of birth on record can match an age.
          </p>
        </div>

        <div>
          <p class="text-sm font-medium text-gray-800 mb-2">Membership type</p>
          <div class="flex flex-wrap gap-2">
            <button v-for="m in MEMBERSHIPS" :key="m.value" type="button"
              class="px-3 py-1.5 rounded-full text-xs font-medium border transition-colors"
              :class="filter.membershipTypes.includes(m.value)
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'"
              @click="toggleIn(filter.membershipTypes, m.value)">{{ m.label }}</button>
          </div>
        </div>

        <div>
          <p class="text-sm font-medium text-gray-800 mb-2">In {{ t('group', true, true) }}</p>
          <MultiSelect v-model="filter.groupIds" :options="groupOptions" option-label="label" option-value="value"
            option-group-label="code" filter display="chip" :placeholder="`Any ${t('group', false, true)}`"
            class="w-full" />
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between w-full">
          <button class="text-xs text-gray-500 hover:text-primary hover:underline" @click="clearFilter">Clear all</button>
          <div class="flex gap-2">
            <Button label="Cancel" severity="secondary" text @click="filterOpen = false" />
            <Button label="Find people" icon="pi pi-search" :loading="matching"
              :disabled="!filterCount"
              style="background:#1E2157;border-color:#1E2157"
              @click="applyFilter" />
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>
