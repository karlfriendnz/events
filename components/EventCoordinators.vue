<script setup lang="ts">
/*
  Event coordinators — the people who administer an event, each with a small
  notification set (registration / payment / cancellation / capacity). Captured
  only for now; nothing is actually sent yet (a follow-up).

  Rebuilt lean: a guarded one-time creator-seed (can never loop), robust
  load/error/finally, and lightweight toggle pills (no per-row expand grid).
*/
const props = withDefaults(defineProps<{
  eventId: string
  embedded?: boolean
  /**
   * Seed the signed-in user as the default coordinator when the list is empty.
   * OFF for an occurrence of a series: its coordinators are inherited from the master
   * at generation, so seeding here would make whoever OPENED that date its coordinator.
   */
  allowSeed?: boolean
  /**
   * DEFER writes until the host calls commit(). Used where this card sits inside a
   * form with its own Save button — adding someone the moment you pick them, in a box
   * you haven't saved yet, is a surprise (and un-undoable by Cancel). Left OFF where
   * the card stands alone and there is nothing to save it with.
   */
  defer?: boolean
}>(), { allowSeed: true, defer: false })
// Tell the host when the roster changes — the event summary shows the names, and
// without this it kept whatever it loaded on mount (add a second coordinator, still
// see one).
// First/last go across separately so the host can shorten them — the summary panel
// shows "Karl F.", the table here shows the full name.
const emit = defineEmits<{ (e: 'changed', people: { id: string; first: string; last: string }[]): void; (e: 'dirty', v: boolean): void }>()
function announce() {
  emit('changed', coordinators.value.map(c => ({
    id: c.personId,
    first: c?.person?.firstName ?? '',
    last: c?.person?.lastName ?? '',
  })))
}

const eventsApi = useEventsApi()
const peopleApi = usePeopleApi()
const { orgId } = useOrg()
const user = useSupabaseUser()
const toast = useToast()

const NOTIF_OPTIONS = [
  { key: 'registration', label: 'New registration' },
  { key: 'payment', label: 'Payment received' },
  { key: 'cancellation', label: 'Cancellation' },
  { key: 'capacity', label: 'Near capacity' },
]
const ALL = NOTIF_OPTIONS.map(o => o.key)

const coordinators = ref<any[]>([])
const loading = ref(true)
const error = ref(false)
let seeded = false   // hard guard — the creator-seed writes at most ONCE per mount

function coName(c: any): string {
  const p = c?.person
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || 'Unknown person'
}
function has(c: any, key: string): boolean {
  return Array.isArray(c?.notifications) && c.notifications.includes(key)
}

async function load() {
  loading.value = true
  error.value = false
  try {
    const res = await eventsApi.eventCoordinators(props.eventId)
    // Guard hard: if the API route isn't registered the dev server returns the SPA
    // HTML as a STRING — v-for would then iterate it char-by-char and OOM the tab.
    if (Array.isArray(res)) { coordinators.value = res }
    else { coordinators.value = []; error.value = true }
  } catch {
    error.value = true
    coordinators.value = []
  } finally {
    loading.value = false
  }
  if (!error.value && !coordinators.value.length && props.allowSeed && !props.defer) await seedCreator()
  else announce()
}

// Seed the signed-in user (the creator, in practice) as the default coordinator —
// exactly once, guarded, and never re-run on failure, so it can't loop.
async function seedCreator() {
  if (seeded) return
  seeded = true
  const email = user.value?.email
  if (!email || !orgId.value) return
  try {
    const person = await peopleApi.findByEmail(orgId.value, email)
    if (!person) return
    const created: any = await eventsApi.addEventCoordinator(props.eventId, person.id, [...ALL])
    if (!created || typeof created !== 'object' || !created.id) return
    created.person = { firstName: person.firstName ?? null, lastName: person.lastName ?? null }
    coordinators.value = [created]
    announce()
  } catch { /* best-effort seed */ }
}

// ── Add ──
const search = ref('')
const suggestions = ref<any[]>([])
const adding = ref(false)
const addInput = ref<any>(null)
function startAdd() {
  adding.value = true
  search.value = ''
  suggestions.value = []
  nextTick(() => addInput.value?.$el?.querySelector('input')?.focus())
}
function cancelAdd() {
  adding.value = false
  search.value = ''
  suggestions.value = []
}
async function onSearch(e: { query: string }) {
  if (!orgId.value) { suggestions.value = []; return }
  try {
    const rows = await peopleApi.list(orgId.value, { q: e.query, limit: 20 })
    const chosen = new Set(coordinators.value.map(c => c.personId))
    suggestions.value = rows
      .filter(r => !chosen.has(r.id))
      .map(r => ({ ...r, _name: [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || 'Unnamed' }))
  } catch { suggestions.value = [] }
}
async function onPick(e: { value: any }) {
  const p = e.value
  search.value = ''
  suggestions.value = []
  if (!p?.id) return
  if (props.defer) {
    const row = { id: `new:${p.id}`, personId: p.id, notifications: [...ALL], person: { firstName: p.firstName ?? null, lastName: p.lastName ?? null } }
    coordinators.value.push(row)
    pendingAdds.value.push(row)
    adding.value = false
    announce()
    return
  }
  try {
    const created: any = await eventsApi.addEventCoordinator(props.eventId, p.id, [...ALL])
    if (!created || typeof created !== 'object' || !created.id) throw new Error('bad response')
    created.person = { firstName: p.firstName ?? null, lastName: p.lastName ?? null }
    coordinators.value.push(created)
    adding.value = false
    announce()
  } catch {
    toast.add({ severity: 'error', summary: 'Could not add coordinator', life: 3000 })
  }
}

// ── Notifications + remove ──
// These save AS YOU CLICK — there's no Save button for them (the event's Save only
// covers the event's own fields), so the row says so: a spinner while it's in flight,
// then a brief "Saved". A failure rolls the pill back rather than leaving the screen
// showing something the database doesn't have.
const savingId = ref<string | null>(null)
const savedId = ref<string | null>(null)

// ── Staged changes (defer mode) ─────────────────────────────────────────────
// Nothing is written until commit(). Rows added locally get a temporary id so the
// table can key + edit them before they exist; removals are remembered so commit()
// can delete them.
const pendingAdds = ref<any[]>([])      // rows not yet created (id starts 'new:')
const pendingRemovals = ref<string[]>([])   // real ids to delete on commit
const pendingNotifs = ref<Record<string, string[]>>({})  // real id -> notifications
const isNew = (c: any) => typeof c?.id === 'string' && c.id.startsWith('new:')
const dirty = computed(() =>
  pendingAdds.value.length > 0 || pendingRemovals.value.length > 0 || Object.keys(pendingNotifs.value).length > 0)
watch(dirty, v => emit('dirty', v))

/** Write everything staged. Safe to call when nothing is staged. */
async function commit() {
  for (const id of pendingRemovals.value) {
    try { await eventsApi.removeEventCoordinator(id) } catch { /* best-effort per row */ }
  }
  for (const [id, notifs] of Object.entries(pendingNotifs.value)) {
    try { await eventsApi.updateEventCoordinator(id, notifs) } catch { /* best-effort */ }
  }
  for (const row of pendingAdds.value) {
    try { await eventsApi.addEventCoordinator(props.eventId, row.personId, row.notifications ?? [...ALL]) }
    catch { /* best-effort */ }
  }
  pendingAdds.value = []
  pendingRemovals.value = []
  pendingNotifs.value = {}
  await load()
}
/** Throw the staged changes away and show what's actually stored. */
async function reset() {
  pendingAdds.value = []
  pendingRemovals.value = []
  pendingNotifs.value = {}
  await load()
}
defineExpose({ commit, reset })
async function toggleNotif(c: any, key: string) {
  const before = Array.isArray(c.notifications) ? [...c.notifications] : []
  const set = new Set<string>(before)
  set.has(key) ? set.delete(key) : set.add(key)
  const next = ALL.filter(k => set.has(k))
  c.notifications = next
  if (props.defer) {
    // A row that doesn't exist yet carries its own notifications into the create.
    if (!isNew(c)) pendingNotifs.value = { ...pendingNotifs.value, [c.id]: next }
    else { const row = pendingAdds.value.find(r => r.id === c.id); if (row) row.notifications = next }
    return
  }
  savingId.value = c.id
  try {
    await eventsApi.updateEventCoordinator(c.id, next)
    savedId.value = c.id
    setTimeout(() => { if (savedId.value === c.id) savedId.value = null }, 1600)
  } catch {
    c.notifications = before
    toast.add({ severity: 'error', summary: 'Could not save', life: 3000 })
  } finally {
    if (savingId.value === c.id) savingId.value = null
  }
}
async function remove(c: any) {
  if (props.defer) {
    coordinators.value = coordinators.value.filter(x => x.id !== c.id)
    if (isNew(c)) pendingAdds.value = pendingAdds.value.filter(r => r.id !== c.id)
    else {
      pendingRemovals.value = [...pendingRemovals.value, c.id]
      const { [c.id]: _drop, ...rest } = pendingNotifs.value
      pendingNotifs.value = rest
    }
    announce()
    return
  }
  try {
    await eventsApi.removeEventCoordinator(c.id)
    coordinators.value = coordinators.value.filter(x => x.id !== c.id)
    announce()
  } catch {
    toast.add({ severity: 'error', summary: 'Could not remove', life: 3000 })
  }
}

onMounted(load)
</script>

<template>
  <div :class="embedded ? '' : 'card p-4 sm:p-5'">
    <!-- Add sits with the heading (the section's action), not under the table. -->
    <div class="flex items-start justify-between gap-3 mb-3">
      <div class="min-w-0">
        <h3 class="section-title">Coordinators</h3>
        <p class="field-help">{{ defer ? 'People who administer this event and get notified about it. Saved with the event.' : 'People who administer this event and get notified about it. Changes here save on their own.' }}</p>
      </div>
      <Button v-if="!loading && !error && !adding" label="Add coordinator" icon="pi pi-plus" size="small" outlined
        class="shrink-0" style="color:var(--brand-primary);border-color:var(--brand-primary)" @click="startAdd" />
    </div>

    <!-- The search only appears once you've said you want to add someone. -->
    <div v-if="adding" class="flex items-center gap-2 mb-3">
      <AutoComplete ref="addInput" v-model="search" :suggestions="suggestions" optionLabel="_name"
        placeholder="Search for a person…" class="flex-1 min-w-0" :pt="{ input: { class: 'w-full' } }"
        @complete="onSearch" @item-select="onPick" />
      <Button label="Cancel" text size="small" severity="secondary" @click="cancelAdd" />
    </div>

    <div v-if="loading" class="flex items-center gap-2 text-sm text-gray-400 py-2">
      <i class="pi pi-spin pi-spinner" /> Loading…
    </div>

    <div v-else-if="error" class="flex items-center justify-between gap-2 text-sm text-gray-500 py-2">
      <span>Couldn't load coordinators.</span>
      <Button label="Retry" text size="small" @click="load" />
    </div>

    <template v-else>
      <!-- ONE ROW PER PERSON: name in one column, their notifications in the next.
           The old stacked card put the pills UNDER the name, so four coordinators
           read as four blocks instead of a list you can scan down. -->
      <div v-if="coordinators.length" class="overflow-x-auto rounded-lg border border-gray-200">
        <table class="w-full min-w-[440px] text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-400">
              <th class="text-left font-bold px-3 py-2">Person</th>
              <th class="text-left font-bold px-3 py-2">Notify about</th>
              <th class="w-10" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="c in coordinators" :key="c.id" class="align-middle hover:bg-gray-50/60">
              <td class="px-3 py-2 text-sm font-medium whitespace-nowrap">
                <!-- The name is the way through to the person — a coordinator is a
                     real member, and their profile is one click away. -->
                <NuxtLink v-if="c.personId" :to="`/people/${c.personId}`"
                  class="text-primary hover:underline">{{ coName(c) }}</NuxtLink>
                <span v-else class="text-gray-800">{{ coName(c) }}</span>
              </td>
              <td class="px-3 py-2">
                <!-- ON is GREEN: these are switches, and green/grey says on/off at a
                     glance where brand-tint vs grey read as two shades of the same. -->
                <div class="flex flex-wrap items-center gap-1.5">
                  <button v-for="o in NOTIF_OPTIONS" :key="o.key" type="button"
                    class="px-2 py-0.5 rounded-full text-xs border transition-colors"
                    :class="has(c, o.key)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'"
                    @click="toggleNotif(c, o.key)">
                    <i v-if="has(c, o.key)" class="pi pi-check text-[10px] mr-1" />{{ o.label }}
                  </button>
                  <!-- There is no Save for these — say so as it happens. -->
                  <span v-if="savingId === c.id" class="text-xs text-gray-400 inline-flex items-center gap-1">
                    <i class="pi pi-spin pi-spinner text-[10px]" />Saving
                  </span>
                  <span v-else-if="savedId === c.id" class="text-xs text-emerald-600 inline-flex items-center gap-1">
                    <i class="pi pi-check text-[10px]" />Saved
                  </span>
                </div>
              </td>
              <td class="px-2 py-2 text-right">
                <Button text rounded size="small" severity="danger" icon="pi pi-times"
                  v-tooltip.top="'Remove'" @click="remove(c)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-sm text-gray-400 py-1">No coordinators yet.</div>
    </template>
  </div>
</template>
