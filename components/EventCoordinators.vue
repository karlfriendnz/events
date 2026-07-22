<script setup lang="ts">
/*
  Event coordinators — the people who administer an event, each with a small
  notification set (registration / payment / cancellation / capacity). Captured
  only for now; nothing is actually sent yet (a follow-up).

  Rebuilt lean: a guarded one-time creator-seed (can never loop), robust
  load/error/finally, and lightweight toggle pills (no per-row expand grid).
*/
const props = defineProps<{ eventId: string; embedded?: boolean }>()

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
  if (!error.value && !coordinators.value.length) await seedCreator()
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
  } catch { /* best-effort seed */ }
}

// ── Add ──
const search = ref('')
const suggestions = ref<any[]>([])
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
  try {
    const created: any = await eventsApi.addEventCoordinator(props.eventId, p.id, [...ALL])
    if (!created || typeof created !== 'object' || !created.id) throw new Error('bad response')
    created.person = { firstName: p.firstName ?? null, lastName: p.lastName ?? null }
    coordinators.value.push(created)
  } catch {
    toast.add({ severity: 'error', summary: 'Could not add coordinator', life: 3000 })
  }
}

// ── Notifications + remove ──
async function toggleNotif(c: any, key: string) {
  const set = new Set<string>(Array.isArray(c.notifications) ? c.notifications : [])
  set.has(key) ? set.delete(key) : set.add(key)
  const next = ALL.filter(k => set.has(k))
  c.notifications = next
  try { await eventsApi.updateEventCoordinator(c.id, next) }
  catch { toast.add({ severity: 'error', summary: 'Could not save', life: 3000 }) }
}
async function remove(c: any) {
  try {
    await eventsApi.removeEventCoordinator(c.id)
    coordinators.value = coordinators.value.filter(x => x.id !== c.id)
  } catch {
    toast.add({ severity: 'error', summary: 'Could not remove', life: 3000 })
  }
}

onMounted(load)
</script>

<template>
  <div :class="embedded ? '' : 'card p-4 sm:p-5'">
    <h3 class="section-title">Coordinators</h3>
    <p class="field-help mb-3">People who administer this event and get notified about it.</p>

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
      <div v-if="coordinators.length" class="overflow-x-auto">
        <table class="w-full min-w-[420px] text-sm">
          <thead>
            <tr class="text-xs font-bold uppercase tracking-wide text-gray-400">
              <th class="text-left font-bold py-1.5 pr-3">Person</th>
              <th class="text-left font-bold py-1.5 pr-3">Notify about</th>
              <th class="w-8" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="c in coordinators" :key="c.id" class="align-middle">
              <td class="py-2 pr-3 text-sm font-medium text-gray-800 whitespace-nowrap">{{ coName(c) }}</td>
              <td class="py-2 pr-3">
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="o in NOTIF_OPTIONS" :key="o.key" type="button"
                    class="px-2 py-0.5 rounded-full text-xs border transition-colors"
                    :class="has(c, o.key)
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'"
                    @click="toggleNotif(c, o.key)">
                    {{ o.label }}
                  </button>
                </div>
              </td>
              <td class="py-2 text-right">
                <Button text rounded size="small" severity="danger" icon="pi pi-times"
                  v-tooltip.top="'Remove'" @click="remove(c)" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-sm text-gray-400 py-1">No coordinators yet.</div>

      <div class="mt-3">
        <AutoComplete v-model="search" :suggestions="suggestions" optionLabel="_name"
          placeholder="Add a coordinator…" class="w-full" :pt="{ input: { class: 'w-full' } }"
          @complete="onSearch" @item-select="onPick" />
        <p class="field-help mt-1">Tap a notification pill to turn it on or off.</p>
      </div>
    </template>
  </div>
</template>
