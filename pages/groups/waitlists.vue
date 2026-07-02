<!--
  Waitlists (/groups/waitlists, migration 221). A waitlist is a shared queue for a
  set of EQUIVALENT groups — the same class on different days/times. Connect
  Group A (Thu) + Group B (Fri) to one waitlist so a spot opening in EITHER can be
  filled from the one queue (and at registration a full Thursday can offer Friday).

  Master-detail: left list of waitlists, right = the selected waitlist's connected
  groups + the people waiting.
-->
<script setup lang="ts">
const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const wl = useWaitlists()
const tm = useTermsMemberships()
const terms = ref<any[]>([])
const gc = useGroupCodes()
const codes = ref<any[]>([])

const waitlists = ref<any[]>([])
const groupLinks = ref<Record<string, { id: string; name: string; color: string | null }[]>>({})
const counts = ref<Record<string, number>>({})
const allGroups = ref<{ id: string; name: string; color: string | null; waitlist_id: string | null; code_id: string | null }[]>([])
const loading = ref(true)

const selectedId = ref<string | null>(null)
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
  const pickable = allGroups.value.filter(g => g.waitlist_id !== selectedId.value)
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
  const [wls, links, cts, { data: groups }, loadedTerms, loadedCodes] = await Promise.all([
    wl.loadWaitlists(), wl.loadGroupLinks(), wl.entryCounts(),
    (db.from as any)('member_groups').select('id, name, color, waitlist_id, code_id').eq('org_id', orgId.value).order('name'),
    tm.loadTerms(),
    gc.loadCodes(),
  ])
  waitlists.value = wls
  groupLinks.value = links
  counts.value = cts
  allGroups.value = groups ?? []
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
}

// New waitlists default to the current-date term (if any).
const activeTermId = computed(() => {
  const today = new Date().toISOString().slice(0, 10)
  return terms.value.find(t => (!t.start_date || t.start_date <= today) && (!t.end_date || t.end_date >= today))?.id ?? null
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
  if (!confirm(`Delete "${selected.value.name}"? People on it and the group connections are removed.`)) return
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
async function reloadGroups() {
  const { data } = await (db.from as any)('member_groups')
    .select('id, name, color, waitlist_id, code_id').eq('org_id', orgId.value).order('name')
  allGroups.value = data ?? []
}

// add a person to the waitlist
const personQuery = ref<any>('')
const personResults = ref<any[]>([])
async function searchPersons(e: { query: string }) {
  const q = (e.query || '').trim()
  if (!q) { personResults.value = []; return }
  const { data } = await (db.from as any)('persons')
    .select('id, first_name, last_name, email')
    .eq('org_id', orgId.value)
    .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`).limit(20)
  personResults.value = (data ?? []).map((p: any) => ({ ...p, label: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email }))
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
// Notes scoped to this waitlist (also surface on the person's profile Notes feed).
const noteLinks = computed(() => selected.value ? [{ type: 'waitlist', id: selected.value.id, label: selected.value.name }] : [])

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 max-w-5xl mx-auto space-y-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <NuxtLink to="/groups" class="text-sm text-gray-500 hover:text-primary inline-flex items-center gap-1">
          <i class="pi pi-arrow-left text-xs" /> Groups
        </NuxtLink>
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900 mt-2">Waitlists</h1>
        <p class="text-sm text-gray-500">A shared queue for equivalent groups — the same class on different days. Connect the groups so a spot opening in any of them fills from one list.</p>
      </div>
    </div>

    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>

    <div v-else class="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-5">
      <!-- waitlist list -->
      <div class="card p-0 overflow-hidden h-fit">
        <div class="px-4 py-2.5 border-b border-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">Waitlists</div>
        <button v-for="w in waitlists" :key="w.id" type="button"
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
                <label class="text-xs font-medium text-gray-600">Term</label>
                <Select :modelValue="selected.term_id" :options="terms" optionLabel="name" optionValue="id"
                  placeholder="No term" showClear class="w-full mt-1" @update:modelValue="setTerm" />
              </div>
            </div>
            <button class="text-gray-300 hover:text-red-500 shrink-0 mt-5" title="Delete waitlist" @click="removeSelected"><i class="pi pi-trash" /></button>
          </div>
          <p class="text-[11px] text-gray-400 mt-2">Tied to a term — when you roll the term over, this waitlist rolls over too (people still waiting carry across).</p>
        </div>

        <!-- connected groups -->
        <AppCard title="Connected groups" description="The equivalent groups this waitlist covers (e.g. Thursday + Friday, same class). A group can only be on one waitlist.">
          <div class="p-4 sm:p-5 space-y-3">
            <!-- currently connected -->
            <div v-if="connectedGroups.length" class="space-y-2">
              <div v-for="g in connectedGroups" :key="g.id" class="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: g.color || '#94a3b8' }" />
                <NuxtLink :to="`/groups/${g.id}`" class="text-sm text-gray-800 hover:text-primary flex-1 min-w-0 truncate">{{ g.name }}</NuxtLink>
                <button class="text-gray-300 hover:text-red-500 shrink-0" title="Disconnect" @click="disconnectGroup(g.id)"><i class="pi pi-times text-xs" /></button>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">No groups connected yet — add the equivalent groups below.</p>

            <!-- add a group -->
            <div class="flex items-center gap-2 pt-1">
              <Select v-model="addGroupId" :options="availableGroupOptions" optionLabel="label" optionValue="value" optionDisabled="disabled"
                optionGroupLabel="label" optionGroupChildren="items" filter
                placeholder="Add a group…" class="flex-1" :emptyMessage="'No groups yet'" />
              <Button icon="pi pi-plus" label="Add" size="small" :disabled="!addGroupId" @click="addGroupConnection" style="background:var(--brand-primary);border-color:var(--brand-primary)" />
            </div>
          </div>
        </AppCard>

        <!-- people waiting -->
        <AppCard title="People waiting" :description="`${entries.length} on the list`">
          <template #header-action>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">Order by</span>
              <Select :modelValue="selected.order_mode || 'custom'" :options="wl.WAITLIST_ORDER_MODES" optionLabel="label" optionValue="value"
                size="small" class="w-48" @update:modelValue="setOrderMode" />
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
                  <p class="text-[11px] text-gray-400 truncate">{{ e.person?.email || e.person?.phone || '—' }}</p>
                </div>
                <!-- priority mode: priority picker -->
                <Select v-if="(selected.order_mode || 'custom') === 'priority'" :modelValue="e.priority ?? 2" :options="wl.WAITLIST_PRIORITIES" optionLabel="label" optionValue="value"
                  size="small" class="w-28 shrink-0" @update:modelValue="p => setPriority(e, p)" />
                <Select :modelValue="e.status" :options="wl.WAITLIST_STATUSES" optionLabel="label" optionValue="value"
                  size="small" class="w-32 shrink-0" @update:modelValue="s => setStatus(e, s)" />
                <PersonNotes :person-id="e.person_id" :person-name="personName(e)" :links="noteLinks" context-label="Waitlist" class="shrink-0" />
                <button class="text-gray-300 hover:text-red-500 shrink-0" title="Remove" @click="removeEntry(e)"><i class="pi pi-times-circle" /></button>
              </div>
            </div>
            <p v-else class="text-sm text-gray-400">No one waiting yet.</p>
            <p v-if="(selected.order_mode || 'custom') === 'fifo' && orderedEntries.length" class="text-[11px] text-gray-400">Ordered by when each person joined the list.</p>
          </div>
        </AppCard>
      </div>
      <div v-else class="card p-8 text-center text-gray-400 text-sm">Create a waitlist, or select one.</div>
    </div>
    <Toast />
  </div>
</template>
