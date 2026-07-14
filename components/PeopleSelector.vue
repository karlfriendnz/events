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
}>(), {
  invitedPersonIds: () => [],
  addedGroupIds: () => [],
  busyPersonId: null,
  busyGroupId: null,
  addedLabel: 'Added',
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
}>()

const db = useDb()
const { orgId } = useOrg()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const gc = useGroupCodes()

const isChosen = (id: string) => props.invitedPersonIds.includes(id)

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
  const q = search.value.trim()

  // People type FULL names. Matching the whole string against first_name OR
  // last_name individually finds nobody for "sam ng" — no single column holds it.
  // So a multi-word query also matches first+last as a pair (either way round).
  const parts = q.split(/\s+/).filter(Boolean)
  const clauses = [
    `first_name.ilike.%${q}%`,
    `last_name.ilike.%${q}%`,
    `email.ilike.%${q}%`,
  ]
  if (parts.length > 1) {
    const [a, b] = [parts[0], parts.slice(1).join(' ')]
    clauses.push(`and(first_name.ilike.%${a}%,last_name.ilike.%${b}%)`)
    clauses.push(`and(first_name.ilike.%${b}%,last_name.ilike.%${a}%)`)
  }

  const { data } = await db.from('persons')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId.value)
    .or(clauses.join(','))
    .order('last_name')
    .limit(20)
  personResults.value = data ?? []
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
  let q = (db.from as any)('persons')
    .select('id, first_name, last_name, email, gender, dob, membership_type')
    .eq('org_id', orgId.value)

  if (filter.genders.length) q = q.in('gender', filter.genders)
  if (filter.membershipTypes.length) q = q.in('membership_type', filter.membershipTypes)

  const { from, to } = dobRange(filter.ageMin, filter.ageMax)
  // An age filter implies a known birth date — someone with no dob can't be shown
  // to match "under 12", so they're excluded rather than silently included.
  if (from) q = q.gte('dob', from)
  if (to) q = q.lte('dob', to)

  // "In any of these classes" — resolve to person ids first, then constrain.
  if (filter.groupIds.length) {
    const { data: mem } = await (db.from as any)('member_group_memberships')
      .select('person_id').in('group_id', filter.groupIds)
    const ids = [...new Set((mem ?? []).map((m: any) => m.person_id))]
    if (!ids.length) { matches.value = []; ran.value = true; matching.value = false; return }
    q = q.in('id', ids)
  }

  const { data } = await q.order('last_name').limit(500)
  matches.value = data ?? []
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

async function loadGroups() {
  groupsLoading.value = true
  const [codes, { data: groups }] = await Promise.all([
    gc.loadCodes(),
    (db.from as any)('member_groups')
      .select('id, name, color, code_id, sort_order, kind')
      .eq('org_id', orgId.value).order('sort_order'),
  ])
  allCodes.value = codes ?? []
  allGroups.value = (groups ?? []).filter((g: any) => g.kind !== 'membership')  // memberships aren't classes
  groupsLoading.value = false
}

interface CodeSection { id: string; name: string; color: string | null; depth: number; groups: any[] }

const codeSections = computed<CodeSection[]>(() => {
  const q = search.value.trim().toLowerCase()
  const hit = (g: any) => !q || g.name.toLowerCase().includes(q)

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

onMounted(loadGroups)
defineExpose({ reloadGroups: loadGroups })
</script>

<template>
  <div class="space-y-3">
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
          <!-- The row is never CONSUMED (no dead "Added" button): re-adding someone
               already in flashes them where they are, rather than doing nothing. -->
          <Button label="Add" :icon="busyPersonId === p.id ? 'pi pi-spin pi-spinner' : 'pi pi-plus'"
            size="small" severity="secondary" outlined
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
        <Button label="Add" :icon="busyPersonId === p.id ? 'pi pi-spin pi-spinner' : 'pi pi-plus'"
          size="small" severity="secondary" outlined
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

    <!-- ── Filter dialog: describe the people you want ── -->
    <Dialog v-model:visible="filterOpen" modal header="Find people" :style="{ width: '95vw', maxWidth: '520px' }">
      <div class="space-y-5">
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
