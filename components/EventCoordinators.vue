<script setup lang="ts">
/*
  Event coordinators — the people who administer an event, each with their own
  notification checklist (registration / payment / cancellation / capacity).
  Captured only for now — nothing is actually sent yet (a follow-up).

  Every event type gets this. The event's creator is seeded as the default
  coordinator (all notifications on) the first time the card loads with none.
*/
const props = defineProps<{ eventId: string }>()

const eventsApi = useEventsApi()
const peopleApi = usePeopleApi()
const { orgId } = useOrg()
const user = useSupabaseUser()
const toast = useToast()

const NOTIF_OPTIONS = [
  { key: 'registration', label: 'New registration' },
  { key: 'payment', label: 'Payment received' },
  { key: 'cancellation', label: 'Cancellation' },
  { key: 'capacity', label: 'Event full / near capacity' },
]
const ALL_NOTIFS = NOTIF_OPTIONS.map(o => o.key)

const coordinators = ref<any[]>([])
const loading = ref(true)

function personName(c: any): string {
  const p = c?.person
  const n = [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim()
  return n || 'Unknown person'
}
function notifLabels(c: any): string[] {
  const set = new Set(c?.notifications ?? [])
  return NOTIF_OPTIONS.filter(o => set.has(o.key)).map(o => o.label)
}

async function loadCoordinators() {
  loading.value = true
  try {
    coordinators.value = await eventsApi.eventCoordinators(props.eventId)
  } catch {
    coordinators.value = []
  }
  loading.value = false
  await seedCreatorIfEmpty()
}

// Seed the signed-in user (the creator, in practice) as the default coordinator
// when the event has none yet — resolves user → person by email like useScopedRoles.
async function seedCreatorIfEmpty() {
  if (coordinators.value.length) return
  const email = user.value?.email
  if (!email || !orgId.value) return
  const person = await peopleApi.findByEmail(orgId.value, email)
  if (!person) return
  try {
    const created = await eventsApi.addEventCoordinator(props.eventId, person.id, [...ALL_NOTIFS])
    created.person = { id: person.id, firstName: person.firstName ?? null, lastName: person.lastName ?? null }
    coordinators.value = [created]
  } catch { /* best-effort seed */ }
}

// ── Add a coordinator ──
const search = ref('')
const suggestions = ref<any[]>([])
async function onSearch(e: { query: string }) {
  if (!orgId.value) { suggestions.value = []; return }
  const rows = await peopleApi.list(orgId.value, { q: e.query, limit: 20 })
  const already = new Set(coordinators.value.map(c => c.personId))
  suggestions.value = rows
    .filter(r => !already.has(r.id))
    .map(r => ({ ...r, _name: [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.email || 'Unnamed' }))
}
async function onPick(e: { value: any }) {
  const person = e.value
  search.value = ''
  suggestions.value = []
  if (!person?.id) return
  try {
    const created = await eventsApi.addEventCoordinator(props.eventId, person.id, [...ALL_NOTIFS])
    created.person = { id: person.id, firstName: person.firstName ?? null, lastName: person.lastName ?? null }
    coordinators.value.push(created)
  } catch {
    toast.add({ severity: 'error', summary: 'Could not add coordinator', life: 3000 })
  }
}

// ── Edit / remove ──
const editOpen = ref<Record<string, boolean>>({})
function toggleEdit(id: string) { editOpen.value[id] = !editOpen.value[id] }

async function toggleNotif(c: any, key: string) {
  const set = new Set<string>(c.notifications ?? [])
  set.has(key) ? set.delete(key) : set.add(key)
  const next = ALL_NOTIFS.filter(k => set.has(k))
  c.notifications = next
  try {
    await eventsApi.updateEventCoordinator(c.id, next)
  } catch {
    toast.add({ severity: 'error', summary: 'Could not save', life: 3000 })
  }
}

async function remove(c: any) {
  try {
    await eventsApi.removeEventCoordinator(c.id)
    coordinators.value = coordinators.value.filter(x => x.id !== c.id)
  } catch {
    toast.add({ severity: 'error', summary: 'Could not remove', life: 3000 })
  }
}

onMounted(loadCoordinators)
watch(() => props.eventId, loadCoordinators)
</script>

<template>
  <div class="card p-4 sm:p-5">
    <div class="flex items-center justify-between mb-1">
      <h3 class="section-title">Coordinators</h3>
    </div>
    <p class="field-help mb-4">People who administer this event and get notified about it.</p>

    <div v-if="loading" class="text-sm text-gray-400 py-2">Loading…</div>

    <div v-else class="space-y-2">
      <div
        v-for="c in coordinators"
        :key="c.id"
        class="border border-gray-200 rounded-lg px-3 py-2.5"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-800 truncate">{{ personName(c) }}</div>
            <div class="text-xs text-gray-500 truncate">
              <span v-if="notifLabels(c).length">{{ notifLabels(c).join(' · ') }}</span>
              <span v-else class="text-gray-400">No notifications</span>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <Button text rounded size="small" :icon="editOpen[c.id] ? 'pi pi-chevron-up' : 'pi pi-bell'"
              v-tooltip.top="'Notifications'" @click="toggleEdit(c.id)" />
            <Button text rounded size="small" severity="danger" icon="pi pi-times"
              v-tooltip.top="'Remove'" @click="remove(c)" />
          </div>
        </div>

        <div v-if="editOpen[c.id]" class="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label
            v-for="opt in NOTIF_OPTIONS"
            :key="opt.key"
            class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
          >
            <Checkbox :binary="true" :modelValue="(c.notifications ?? []).includes(opt.key)"
              @update:modelValue="() => toggleNotif(c, opt.key)" />
            <span>{{ opt.label }}</span>
          </label>
        </div>
      </div>

      <div v-if="!coordinators.length" class="text-sm text-gray-400 py-1">No coordinators yet.</div>
    </div>

    <div class="mt-3">
      <AutoComplete
        v-model="search"
        :suggestions="suggestions"
        optionLabel="_name"
        placeholder="Add a coordinator…"
        class="w-full"
        :pt="{ input: { class: 'w-full' } }"
        @complete="onSearch"
        @item-select="onPick"
      />
    </div>
  </div>
</template>
