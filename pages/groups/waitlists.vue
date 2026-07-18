<!--
  Waitlists (/groups/waitlists, migration 221). A waitlist is a shared queue for a
  set of EQUIVALENT groups — the same class on different days/times. Connect
  Group A (Thu) + Group B (Fri) to one waitlist so a spot opening in EITHER can be
  filled from the one queue (and at registration a full Thursday can offer Friday).

  Master-detail: left list of waitlists, right = the selected waitlist's connected
  groups + the people waiting.
-->
<script setup lang="ts">
const peopleApi = usePeopleApi()
const { orgId } = useOrg()
const toast = useToast()
const wl = useWaitlists()
const groupsApi = useGroupsApi()
// member_groups → the snake shape this page's group picker reads.
const toGroupRow = (g: any) => ({
  id: g.id, name: g.name, color: g.color, waitlist_id: g.waitlistId,
  code_id: g.codeId, capacity: g.capacity, location_id: g.locationId,
})
const tm = useTermsMemberships()
const finder = useClassFinder()
const { ensureTerms, t } = useTerms()
void ensureTerms()
const terms = ref<any[]>([])
const gc = useGroupCodes()
const codes = ref<any[]>([])

const waitlists = ref<any[]>([])
const groupLinks = ref<Record<string, { id: string; name: string; color: string | null }[]>>({})
const counts = ref<Record<string, number>>({})
const allGroups = ref<{ id: string; name: string; color: string | null; waitlist_id: string | null; code_id: string | null; capacity: number | null }[]>([])
// member counts per connected group + how many groups each waitlisted person is in.
const connectedCounts = ref<Record<string, number>>({})
const personEnrolled = ref<Record<string, number>>({})
const loading = ref(true)

const selectedId = ref<string | null>(null)
const visibleWaitlists = computed(() => waitlists.value.filter(w => {
  if (!wlLens.value) return true
  const conn = allGroups.value.filter(g => g.waitlist_id === w.id)
  return !conn.length || conn.some(g => wlInLens(g.location_id))
}))
const selected = computed(() => waitlists.value.find(w => w.id === selectedId.value) || null)

// Groups connected to the selected waitlist (live from allGroups.waitlist_id).
const connectedGroups = computed(() => allGroups.value.filter(g => g.waitlist_id === selectedId.value))
// A group belongs to ONE waitlist. The picker shows every group EXCEPT the ones
// already on THIS waitlist (they're in the connected list); groups on ANOTHER
// waitlist are shown but DISABLED, labelled with which waitlist has them — so the
// one-waitlist rule is clear rather than silently hiding them.
const waitlistNameById = computed(() => Object.fromEntries(waitlists.value.map(w => [w.id, w.name])) as Record<string, string>)
// Hierarchy view: groups are grouped under their CODE (in tree order), with an
// "Ungrouped" bucket for codeless groups. Groups on another waitlist show disabled.
// (This is the standard shape for any group-selection dropdown — group by code.)
const availableGroupOptions = computed(() => {
  const toItem = (g: any) => ({
    label: g.waitlist_id ? `${g.name}  ·  on “${waitlistNameById.value[g.waitlist_id] || 'another waitlist'}”` : g.name,
    value: g.id, disabled: !!g.waitlist_id,
  })
  const pickable = allGroups.value.filter(g => g.waitlist_id !== selectedId.value && wlInLens(g.location_id))
  const byCode: Record<string, any[]> = {}
  for (const g of pickable) (byCode[g.code_id || '__none'] ??= []).push(g)
  const out: { label: string; items: any[] }[] = []
  for (const c of gc.treeOptions(codes.value)) {
    if (byCode[c.value]?.length) out.push({ label: c.label, items: byCode[c.value].map(toItem) })
  }
  if (byCode['__none']?.length) out.push({ label: 'Ungrouped', items: byCode['__none'].map(toItem) })
  return out
})
const addGroupId = ref<string | null>(null)

// entries for the selected waitlist
const entries = ref<any[]>([])
const newName = ref('')

async function load() {
  loading.value = true
  const [wls, links, cts, groups, loadedTerms, loadedCodes] = await Promise.all([
    wl.loadWaitlists(), wl.loadGroupLinks(), wl.entryCounts(),
    groupsApi.list(orgId.value).catch(() => [] as any[]),
    tm.loadTerms(),
    gc.loadCodes(),
  ])
  waitlists.value = wls
  groupLinks.value = links
  counts.value = cts
  allGroups.value = (groups ?? []).map(toGroupRow)
  terms.value = loadedTerms ?? []
  codes.value = loadedCodes ?? []
  if (!selected.value && waitlists.value.length) selectedId.value = waitlists.value[0].id
  loading.value = false
  if (selected.value) await selectWaitlist(selected.value.id)
}

async function selectWaitlist(id: string) {
  selectedId.value = id
  addGroupId.value = null
  entries.value = await wl.loadEntries(id)
  personEnrolled.value = await wl.enrolledCounts(entries.value.map(e => e.person_id))
  await loadConnectedCounts()
}
// Member counts for this waitlist's connected groups (to compute spare spaces).
async function loadConnectedCounts() {
  connectedCounts.value = {}
  const ids = connectedGroups.value.map(g => g.id)
  if (!ids.length) return
  const roster = await groupsApi.roster(ids)
  const c: Record<string, number> = {}
  for (const m of roster ?? []) c[m.groupId] = (c[m.groupId] ?? 0) + 1
  connectedCounts.value = c
}
// Connected groups that still have room (for the enrol action).
const connectedGroupsWithSpace = computed(() => connectedGroups.value
  .map(g => ({ id: g.id, name: g.name, capacity: g.capacity, count: connectedCounts.value[g.id] ?? 0 }))
  .filter(g => g.capacity == null || g.count < g.capacity))
const enrolOptions = computed(() => connectedGroupsWithSpace.value.map(g => ({
  label: g.capacity != null ? `${g.name} (${g.count}/${g.capacity})` : `${g.name} (${g.count})`, value: g.id,
})))
// Total spare spaces across the connected groups (∞ if any is uncapped).
const spacesLabel = computed(() => {
  const gs = connectedGroups.value
  if (!gs.length) return '—'
  if (gs.some(g => g.capacity == null)) return '∞'
  return String(gs.reduce((s, g) => s + Math.max(0, (g.capacity as number) - (connectedCounts.value[g.id] ?? 0)), 0))
})
function age(dob: string | null | undefined): string {
  if (!dob) return '—'
  const d = new Date(dob); if (isNaN(d.getTime())) return '—'
  const now = new Date(); let a = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--
  return a >= 0 && a < 130 ? String(a) : '—'
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso); if (isNaN(d.getTime())) return '—'
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
}
// Enrol a waitlisted person INTO a connected group (removes them from the waitlist).
const enrolEntry = ref<any>(null)   // the entry whose enrol dialog is open
async function enrolIntoGroup(entry: any, groupId: string | null) {
  if (!groupId || !entry) return
  const g = connectedGroups.value.find(x => x.id === groupId)
  const r = await wl.enrolFromWaitlist(entry.id, groupId, entry.person_id)
  enrolEntry.value = null
  if (r.ok) {
    entries.value = entries.value.filter(e => e.id !== entry.id)
    await refreshCounts(); await loadConnectedCounts()
    toast.add({ severity: 'success', summary: `Enrolled ${personName(entry)} in ${g?.name ?? t('group', false, true)} — off the waitlist`, life: 3000 })
  } else {
    toast.add({ severity: 'error', summary: 'Could not enrol', detail: r.error, life: 4000 })
  }
}

// New waitlists default to the current-date term (if any).
const activeTermId = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return terms.value.find(tr => (!tr.start_date || tr.start_date <= today) && (!tr.end_date || tr.end_date >= today))?.id ?? null
})
async function createWaitlist() {
  const name = newName.value.trim()
  if (!name) return
  const w = await wl.createWaitlist(name, activeTermId.value)
  newName.value = ''
  if (w) { await load(); await selectWaitlist(w.id) }
}
async function renameSelected() {
  if (!selected.value?.name.trim()) return
  await wl.updateWaitlist(selected.value.id, { name: selected.value.name.trim() })
  toast.add({ severity: 'success', summary: 'Saved', life: 1400 })
}
async function setTerm(termId: string | null) {
  if (!selected.value) return
  selected.value.term_id = termId
  await wl.updateWaitlist(selected.value.id, { term_id: termId })
}
async function removeSelected() {
  if (!selected.value) return
  if (!confirm(`Delete "${selected.value.name}"? People on it and the ${t('group', false, true)} connections are removed.`)) return
  await wl.deleteWaitlist(selected.value.id)
  selectedId.value = null
  await load()
}

// Connect/disconnect a single group — autosaves.
async function addGroupConnection() {
  if (!selected.value || !addGroupId.value) return
  await wl.connectGroup(addGroupId.value, selected.value.id)
  addGroupId.value = null
  await reloadGroups()
}
async function disconnectGroup(groupId: string) {
  await wl.connectGroup(groupId, null)
  await reloadGroups()
}
// Location lens: group pickers + connected lists only offer in-lens classes;
// a waitlist shows if ANY of its connected classes is in the lens (or it has none).
const { activeLocationId: wlLens, inActiveLocation: wlInLens } = useActiveLocation()
async function reloadGroups() {
  const groups = await groupsApi.list(orgId.value).catch(() => [] as any[])
  allGroups.value = (groups ?? []).map(toGroupRow)
}

// add a person to the waitlist
const personQuery = ref<any>('')
const personResults = ref<any[]>([])
async function searchPersons(e: { query: string }) {
  const q = (e.query || '').trim()
  if (!q) { personResults.value = []; return }
  const people = await peopleApi.list(orgId.value, { q, limit: 20 }).catch(() => [] as any[])
  personResults.value = (people ?? []).map((p: any) => ({
    id: p.id,
    label: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.email,
  }))
}
async function pickPerson(e: { value: any }) {
  const p = e.value
  if (!p?.id || !selected.value) return
  const r = await wl.addEntry(selected.value.id, p.id, entries.value.length)
  personQuery.value = ''
  personResults.value = []
  if (r.ok) { entries.value = await wl.loadEntries(selected.value.id); await refreshCounts() }
  else toast.add({ severity: 'warn', summary: 'Already on this waitlist', life: 2500 })
}
// Entries ordered by the waitlist's mode (custom / fifo / priority).
const orderedEntries = computed(() => wl.orderEntries(entries.value, selected.value?.order_mode))
async function setOrderMode(mode: any) {
  if (!selected.value) return
  selected.value.order_mode = mode
  await wl.updateWaitlist(selected.value.id, { order_mode: mode })
}
// Custom order: move a row up/down and persist sort_order.
async function moveEntry(i: number, dir: number) {
  const arr = [...orderedEntries.value]
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  const [it] = arr.splice(i, 1)
  arr.splice(j, 0, it)
  arr.forEach((e, idx) => { const m = entries.value.find(x => x.id === e.id); if (m) m.sort_order = idx })
  await wl.reorderEntries(arr.map(e => e.id))
}
async function setPriority(entry: any, p: number) {
  entry.priority = p
  await wl.updateEntry(entry.id, { priority: p })
}
async function setStatus(entry: any, status: string) {
  entry.status = status
  await wl.updateEntry(entry.id, { status })
  await refreshCounts()
}
async function removeEntry(entry: any) {
  await wl.removeEntry(entry.id)
  entries.value = entries.value.filter(e => e.id !== entry.id)
  await refreshCounts()
}
async function refreshCounts() { counts.value = await wl.entryCounts() }
const personName = (e: any) => `${e.person?.first_name ?? ''} ${e.person?.last_name ?? ''}`.trim() || e.person?.email || 'Person'
// Export the current waitlist to CSV (mirrors the old-FM waitlist columns).
function exportCsv() {
  const header = ['#', 'Name', 'Email', 'Phone', 'Age', `Enrolled (${t('group', true, true)})`, 'Status', 'Priority', 'Date added']
  const rows = orderedEntries.value.map((e, i) => [
    i + 1, personName(e), e.person?.email ?? '', e.person?.phone ?? '', age(e.person?.dob),
    personEnrolled.value[e.person_id] ?? 0, e.status, (wl.WAITLIST_PRIORITIES.find(p => p.value === (e.priority ?? 2))?.label ?? ''),
    fmtDate(e.created_at),
  ])
  const esc = (c: any) => `"${String(c).replace(/"/g, '""')}"`
  const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${(selected.value?.name || 'waitlist').replace(/[^\w-]+/g, '-')}.csv`; a.click()
  URL.revokeObjectURL(url)
}
// Notes scoped to this waitlist (also surface on the person's profile Notes feed).
const noteLinks = computed(() => selected.value ? [{ type: 'waitlist', id: selected.value.id, label: selected.value.name }] : [])

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <NuxtLink to="/groups" class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1">
          <i class="pi pi-arrow-left text-xs" /> {{ t('group', true) }}
        </NuxtLink>
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 mt-2">Waitlists</h1>
        <p class="text-sm text-gray-500">A shared queue for equivalent {{ t('group', true, true) }} — the same {{ t('group', false, true) }} on different days. Connect the {{ t('group', true, true) }} so a spot opening in any of them fills from one list.</p>
      </div>
      <button type="button" @click="finder.openFinder()"
        class="shrink-0 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300">
        <i class="pi pi-search text-xs" /> Find a {{ t('group', false, true) }}
      </button>
    </div>

    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
      <!-- waitlist list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">Waitlists</div>
        <button v-for="w in visibleWaitlists" :key="w.id" type="button"
          class="w-full text-left px-4 py-2.5 text-sm border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
          :class="w.id === selectedId ? 'bg-gray-50 font-medium text-primary' : 'text-gray-700'"
          @click="selectWaitlist(w.id)">
          <span class="truncate">{{ w.name }}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">{{ counts[w.id] || 0 }} waiting</span>
        </button>
        <div v-if="!waitlists.length" class="px-4 py-3 text-xs text-gray-400">No waitlists yet.</div>
        <div class="p-3 border-t border-gray-100 flex gap-2">
          <InputText v-model="newName" placeholder="New waitlist name" class="flex-1" size="small" @keyup.enter="createWaitlist" />
          <Button icon="pi pi-plus" size="small" :disabled="!newName.trim()" @click="createWaitlist" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
        </div>
      </div>

      <!-- detail -->
      <div v-if="selected" class="space-y-4">
        <!-- name + term -->
        <div class="card p-4 sm:p-5">
          <div class="flex items-start justify-between gap-3">
            <div class="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3 flex-1 min-w-0">
              <div class="min-w-0">
                <label class="text-xs font-medium text-gray-600">Waitlist name</label>
                <InputText v-model="selected.name" class="w-full mt-1" @blur="renameSelected" @keyup.enter="renameSelected" />
              </div>
              <div class="min-w-0">
                <label class="text-xs font-medium text-gray-600">{{ t('term') }}</label>
                <Select :modelValue="selected.term_id" :options="terms" optionLabel="name" optionValue="id"
                  :placeholder="`No ${t('term', false, true)}`" showClear class="w-full mt-1" @update:modelValue="setTerm" />
              </div>
            </div>
            <button class="text-gray-300 hover:text-red-500 shrink-0 mt-5" title="Delete waitlist" @click="removeSelected"><i class="pi pi-trash" /></button>
          </div>
          <p class="text-[11px] text-gray-400 mt-2">Tied to a {{ t('term', false, true) }} — when you roll the {{ t('term', false, true) }} over, this waitlist rolls over too (people still waiting carry across).</p>
        </div>

        <!-- connected groups -->
        <AppCard :title="`Connected ${t('group', true)}`" :description="`The equivalent ${t('group', true, true)} this waitlist covers (e.g. Thursday + Friday, same ${t('group', false, true)}). A ${t('group', false, true)} can only be on one waitlist.`">
          <div class="p-4 sm:p-5 space-y-3">
            <!-- currently connected -->
            <div v-if="connectedGroups.length" class="space-y-2">
              <div v-for="g in connectedGroups" :key="g.id" class="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#94a3b8' }" />
                <NuxtLink :to="`/groups/${g.id}`" class="text-sm text-gray-800 hover:text-primary flex-1 min-w-0 truncate">{{ g.name }}</NuxtLink>
                <button class="text-gray-300 hover:text-red-500 shrink-0" title="Disconnect" @click="disconnectGroup(g.id)"><i class="pi pi-times text-xs" /></button>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">No {{ t('group', true, true) }} connected yet — add the equivalent {{ t('group', true, true) }} below.</p>

            <!-- add a group -->
            <div class="flex items-center gap-2 pt-1">
              <Select v-model="addGroupId" :options="availableGroupOptions" optionLabel="label" optionValue="value" optionDisabled="disabled"
                optionGroupLabel="label" optionGroupChildren="items" filter
                :placeholder="`Add a ${t('group', false, true)}…`" class="flex-1" :emptyMessage="`No ${t('group', true, true)} yet`" />
              <Button icon="pi pi-plus" label="Add" size="small" :disabled="!addGroupId" @click="addGroupConnection" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </AppCard>

        <!-- people waiting -->
        <AppCard title="People waiting" :description="`${entries.length} on the list · ${spacesLabel} space${spacesLabel === '1' ? '' : 's'} in connected ${t('group', true, true)}`">
          <template #header-action>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400 hidden sm:inline">Order by</span>
              <Select :modelValue="selected.order_mode || 'custom'" :options="wl.WAITLIST_ORDER_MODES" optionLabel="label" optionValue="value"
                size="small" class="w-40 sm:w-48" @update:modelValue="setOrderMode" />
              <Button icon="pi pi-download" label="CSV" size="small" outlined :disabled="!orderedEntries.length" @click="exportCsv" :pt="{ label: { class: 'hidden sm:inline' } }" />
            </div>
          </template>
          <div class="p-4 sm:p-5 space-y-3">
            <AutoComplete v-model="personQuery" :suggestions="personResults" optionLabel="label"
              placeholder="Add a person to the waitlist…" class="w-full" dropdown forceSelection
              @complete="searchPersons" @item-select="pickPerson" />

            <div v-if="orderedEntries.length" class="card p-0 overflow-hidden">
              <div v-for="(e, i) in orderedEntries" :key="e.id" class="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 border-b border-gray-50 last:border-0">
                <span class="w-5 text-center text-xs text-gray-400 shrink-0">{{ i + 1 }}</span>
                <!-- custom order: up/down -->
                <div v-if="(selected.order_mode || 'custom') === 'custom'" class="flex flex-col shrink-0 -my-1">
                  <button class="text-gray-300 hover:text-primary disabled:opacity-30 leading-none" :disabled="i === 0" title="Move up" @click="moveEntry(i, -1)"><i class="pi pi-chevron-up text-[10px]" /></button>
                  <button class="text-gray-300 hover:text-primary disabled:opacity-30 leading-none" :disabled="i === orderedEntries.length - 1" title="Move down" @click="moveEntry(i, 1)"><i class="pi pi-chevron-down text-[10px]" /></button>
                </div>
                <div class="min-w-0 flex-1">
                  <NuxtLink :to="`/people/${e.person_id}`" class="text-sm font-medium text-gray-800 hover:text-primary">{{ personName(e) }}</NuxtLink>
                  <p class="text-[11px] text-gray-400 truncate">
                    {{ e.person?.email || e.person?.phone || '—' }}
                    <span class="text-gray-300"> · </span>Age {{ age(e.person?.dob) }}
                    <span class="text-gray-300"> · </span>{{ personEnrolled[e.person_id] ?? 0 }} {{ (personEnrolled[e.person_id] ?? 0) === 1 ? t('group', false, true) : t('group', true, true) }}
                    <span class="text-gray-300"> · </span>Added {{ fmtDate(e.created_at) }}
                  </p>
                </div>
                <!-- enrol into a connected group with space → off the waitlist -->
                <Button v-if="enrolOptions.length" label="Enrol" icon="pi pi-sign-in" size="small" outlined severity="success"
                  class="shrink-0" :pt="{ label: { class: 'hidden lg:inline' } }" @click="enrolEntry = e"
                  v-tooltip.top="`Enrol into a connected ${t('group', false, true)} with space (removes them from the waitlist)`" />
                <!-- priority mode: priority picker -->
                <Select v-if="(selected.order_mode || 'custom') === 'priority'" :modelValue="e.priority ?? 2" :options="wl.WAITLIST_PRIORITIES" optionLabel="label" optionValue="value"
                  size="small" class="w-24 sm:w-28 shrink-0" @update:modelValue="p => setPriority(e, p)" />
                <Select :modelValue="e.status" :options="wl.WAITLIST_STATUSES" optionLabel="label" optionValue="value"
                  size="small" class="w-28 sm:w-32 shrink-0" @update:modelValue="s => setStatus(e, s)" />
                <PersonNotes :person-id="e.person_id" :person-name="personName(e)" :links="noteLinks" context-label="Waitlist" class="shrink-0" />
                <button class="text-gray-300 hover:text-red-500 shrink-0" title="Remove from waitlist" @click="removeEntry(e)"><i class="pi pi-times-circle" /></button>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">No one waiting yet.</p>
            <p v-if="(selected.order_mode || 'custom') === 'fifo' && orderedEntries.length" class="text-[11px] text-gray-400">Ordered by when each person joined the list.</p>
          </div>
        </AppCard>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">Create a waitlist, or select one.</div>
    </div>

    <!-- Enrol-from-waitlist dialog: pick a connected group with space -->
    <Dialog :visible="!!enrolEntry" modal :closable="true" :header="`Enrol ${enrolEntry ? personName(enrolEntry) : ''}`"
      :style="{ width: '95vw', maxWidth: '420px' }" @update:visible="v => { if (!v) enrolEntry = null }">
      <p class="text-sm text-gray-500 mb-3">Choose a connected {{ t('group', false, true) }} with space. This enrols them into the {{ t('group', false, true) }} and removes them from the waitlist.</p>
      <div class="space-y-2">
        <button v-for="g in connectedGroupsWithSpace" :key="g.id" type="button"
          class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-primary hover:bg-primary/5 text-left transition-colors"
          @click="enrolIntoGroup(enrolEntry, g.id)">
          <span class="text-sm text-gray-800 truncate">{{ g.name }}</span>
          <span class="text-xs text-gray-500 shrink-0">{{ g.count }}<span v-if="g.capacity != null">/{{ g.capacity }}</span> · <span class="text-emerald-600 font-medium">Enrol here</span></span>
        </button>
        <p v-if="!connectedGroupsWithSpace.length" class="text-sm text-gray-400">No connected {{ t('group', true, true) }} have space right now.</p>
      </div>
    </Dialog>
    <Toast />
  </div>
</template>
