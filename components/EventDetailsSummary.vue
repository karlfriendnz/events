<!--
  Reusable event details summary — a compact card that shows the essentials (name /
  when / location / status) and edits them inline. Self-contained by `event-id`
  (loads + saves via the useEventsApi seam). Emits `loaded` (for breadcrumbs/guards),
  `invite` (host opens its own invite flow), and `updated` after a save.
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
const props = defineProps<{ eventId: string }>()
const emit = defineEmits<{
  (e: 'loaded', ev: any): void; (e: 'invite'): void; (e: 'updated', ev: any): void
  (e: 'deleted'): void; (e: 'duplicated', newId: string): void
}>()

const eventsApi = useEventsApi()
const bookingsApi = useBookingsApi()
const { orgId } = useOrg()
const toast = useToast()

const event = ref<any>(null)
const loading = ref(true)
const resolvedVenue = ref('')
const categories = ref<any[]>([])
const categoriesById = computed(() => Object.fromEntries(categories.value.map((c: any) => [c.id, c])))
async function loadCategories() {
  if (!orgId.value) return
  try { categories.value = await eventsApi.categories(orgId.value) } catch { categories.value = [] }
}

// A "Venue" location stores a bookable id, not a name — resolve the bookable's name.
async function resolveVenue() {
  resolvedVenue.value = ''
  const ev = event.value
  const l0 = Array.isArray(ev?.locations) && ev.locations.length ? ev.locations[0] : null
  const bid = (l0?.type === 'BOOKABLE' ? l0.bookable_ids?.[0] : null) || (ev?.locationType === 'BOOKABLE' ? ev?.bookableId : null)
  if (!bid) return
  try { const b = await bookingsApi.bookable(bid); resolvedVenue.value = b?.name || '' } catch { /* ignore */ }
}

async function load() {
  loading.value = true
  try { event.value = await eventsApi.get(props.eventId); resolveVenue() } catch { event.value = null }
  finally { loading.value = false; emit('loaded', event.value) }
}
onMounted(() => { load(); loadCategories() })
watch(() => props.eventId, load)
defineExpose({ reload: load })

// ── Read-mode display ──
const whenLabel = computed(() => {
  const ev = event.value
  if (!ev?.startAt) return 'No date set'
  const s = new Date(ev.startAt)
  const d = s.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  if (ev.isAllDay) return `${d} · All day`
  const tOpts: any = { hour: 'numeric', minute: '2-digit' }
  let out = `${d} · ${s.toLocaleTimeString(undefined, tOpts)}`
  if (ev.endAt) out += ` – ${new Date(ev.endAt).toLocaleTimeString(undefined, tOpts)}`
  return out
})
// Read-mode location as a plain summary line (no expanded editor).
const locationSummaryText = computed(() => {
  const ev = event.value
  if (!ev) return ''
  const l0 = Array.isArray(ev.locations) && ev.locations.length ? ev.locations[0] : null
  if (l0) {
    if (l0.type === 'ONLINE') return l0.meeting_link ? 'Online' : ''
    if (l0.type === 'BOOKABLE') return resolvedVenue.value || l0.venue_name || 'Venue'
    return l0.address || l0.venue_name || ''
  }
  if (ev.locationType === 'ONLINE') return ev.meetingLink ? 'Online' : ''
  if (ev.locationType === 'BOOKABLE') return resolvedVenue.value || 'Venue'
  return ev.address || ''
})
const statusLabel = computed(() => {
  const s = String(event.value?.status || '')
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''
})
const statusSeverity = computed(() =>
  event.value?.status === 'PUBLISHED' ? 'success' : event.value?.status === 'CANCELLED' ? 'danger' : 'secondary')

// ── Inline edit ──
const STATUS_OPTIONS = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Cancelled', value: 'CANCELLED' },
]
const editing = ref(false)
const saving = ref(false)
const form = reactive<{
  title: string; status: string; is_all_day: boolean
  start_date: Date | null; start_time: Date | null; end_date: Date | null; end_time: Date | null
  category_id: string | null; locations: any[]
}>({ title: '', status: 'PUBLISHED', is_all_day: false, start_date: null, start_time: null, end_date: null, end_time: null, category_id: null, locations: [] })

function startEdit() {
  const ev = event.value
  form.title = ev.title || ''
  form.status = ev.status || 'PUBLISHED'
  form.category_id = ev.categoryId ?? null
  form.is_all_day = !!ev.isAllDay
  form.start_date = ev.startAt ? new Date(ev.startAt) : null
  form.start_time = ev.startAt && !ev.isAllDay ? new Date(ev.startAt) : null
  form.end_date = ev.endAt ? new Date(ev.endAt) : (ev.startAt ? new Date(ev.startAt) : null)
  form.end_time = ev.endAt && !ev.isAllDay ? new Date(ev.endAt) : null
  form.locations = [{ type: ev.locationType || 'ADDRESS', venue_name: '', address: ev.address || '', meeting_link: ev.meetingLink || '', bookable_ids: [] }]
  editing.value = true
}
function buildDT(date: Date | null, time: Date | null, allDay: boolean): string | null {
  if (!date) return null
  const d = new Date(date)
  if (time && !allDay) d.setHours(time.getHours(), time.getMinutes(), 0, 0)
  else d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
// ── Copy / Delete (the ⋯ menu) ──
const menu = ref()
const busy = ref(false)
const deleteOpen = ref(false)
const menuItems = [
  { label: 'Duplicate', icon: 'pi pi-copy', command: () => duplicate() },
  { label: 'Delete', icon: 'pi pi-trash', class: 'text-red-600', command: () => { deleteOpen.value = true } },
]
function toggleMenu(e: Event) { menu.value?.toggle(e) }

// Copy the event as a new draft (title "Copy of …"), then carry its invitees over.
async function duplicate() {
  const ev = event.value
  if (!ev || busy.value) return
  busy.value = true
  try {
    const created = await eventsApi.create({
      orgId: orgId.value,
      title: `Copy of ${ev.title || 'event'}`,
      status: 'DRAFT',
      style: ev.style || 'BASIC',
      createdVia: ev.createdVia || 'quick',
      isProgramme: !!ev.isProgramme,
      isAllDay: !!ev.isAllDay,
      startAt: ev.startAt ?? null,
      endAt: ev.endAt ?? null,
      recurrenceRule: ev.recurrenceRule ?? null,
      exdates: ev.exdates ?? [],
      categoryId: ev.categoryId ?? null,
      locations: ev.locations ?? [],
      locationType: ev.locationType ?? 'ADDRESS',
      address: ev.address ?? null,
      meetingLink: ev.meetingLink ?? null,
    } as any)
    // Carry the invitees (people only — RSVP status reset to INVITED for the new event).
    try {
      const invs = await eventsApi.invitees(props.eventId)
      for (const inv of invs) {
        if (!inv.personId) continue
        await eventsApi.addInvitee(created.id, { personId: inv.personId, roles: (inv as any).roles ?? [], role: (inv as any).role ?? null, status: 'INVITED' })
      }
    } catch { /* invitees are best-effort — the copied event still stands */ }
    toast.add({ severity: 'success', summary: 'Event duplicated', life: 1800 })
    emit('duplicated', created.id)
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not duplicate', detail: e?.message, life: 4000 })
  } finally { busy.value = false }
}

async function doDelete() {
  if (busy.value) return
  busy.value = true
  try {
    await eventsApi.remove(props.eventId)
    deleteOpen.value = false
    toast.add({ severity: 'success', summary: 'Event deleted', life: 1800 })
    emit('deleted')
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not delete', detail: e?.message, life: 4000 })
  } finally { busy.value = false }
}

async function saveDetails() {
  if (!form.title.trim()) return
  saving.value = true
  const loc: any = form.locations[0] || {}
  try {
    const updated = await eventsApi.update(props.eventId, {
      title: form.title.trim(),
      status: form.status,
      categoryId: form.category_id || null,
      isAllDay: form.is_all_day,
      startAt: buildDT(form.start_date, form.start_time, form.is_all_day),
      endAt: buildDT(form.end_date || form.start_date, form.end_time, form.is_all_day),
      locations: form.locations,
      locationType: loc.type ?? 'ADDRESS',
      address: loc.type === 'ADDRESS' ? (loc.address || null) : null,
      meetingLink: loc.type === 'ONLINE' ? (loc.meeting_link || null) : null,
    } as any)
    event.value = updated
    resolveVenue()
    editing.value = false
    emit('updated', updated)
    emit('loaded', updated)
    toast.add({ severity: 'success', summary: 'Saved', life: 1800 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Could not save', detail: e?.message, life: 4000 })
  } finally { saving.value = false }
}
</script>

<template>
  <div class="card p-4 sm:p-5">
    <div v-if="loading" class="text-sm text-gray-400 py-2">Loading…</div>
    <div v-else-if="!event" class="text-sm text-gray-400 py-2">Event not found.</div>

    <!-- Read mode — labeled rows (no inputs, location as a summary line) -->
    <template v-else-if="!editing">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0 space-y-2.5">
          <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20">Name</span>
            <span class="text-sm font-medium text-gray-900 break-words">{{ event.title }}</span>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20">When</span>
            <span class="text-sm text-gray-700">{{ whenLabel }}</span>
          </div>
          <div class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20">Status</span>
            <Tag :value="statusLabel" :severity="statusSeverity" />
          </div>
          <div v-if="event.categoryId && categoriesById[event.categoryId]" class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20">Category</span>
            <span class="inline-flex items-center gap-1.5 text-sm text-gray-700">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: categoriesById[event.categoryId].color || '#94a3b8' }" />
              {{ categoriesById[event.categoryId].name }}
            </span>
          </div>
          <div v-if="locationSummaryText" class="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4">
            <span class="field-label shrink-0 sm:w-20">Location</span>
            <span class="text-sm text-gray-700">{{ locationSummaryText }}</span>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button class="text-gray-400 hover:text-primary w-8 h-8 flex items-center justify-center" v-tooltip.top="'Edit details'" @click="startEdit"><i class="pi pi-pencil" /></button>
          <button class="text-gray-400 hover:text-primary w-8 h-8 flex items-center justify-center" v-tooltip.top="'More'" @click="toggleMenu" :disabled="busy"><i class="pi pi-ellipsis-v" /></button>
          <Menu ref="menu" :model="menuItems" :popup="true" />
        </div>
      </div>
    </template>

    <!-- Delete confirmation -->
    <Dialog v-model:visible="deleteOpen" modal :draggable="false" header="Delete event?" :style="{ width: '95vw', maxWidth: '400px' }">
      <p class="text-sm text-gray-600">This permanently deletes <span class="font-medium text-gray-900">{{ event?.title }}</span> and its invitees. This can't be undone.</p>
      <template #footer>
        <Button label="Cancel" severity="secondary" text size="small" @click="deleteOpen = false" />
        <Button label="Delete event" icon="pi pi-trash" severity="danger" size="small" :loading="busy" @click="doDelete" />
      </template>
    </Dialog>

    <!-- Edit mode -->
    <div v-else class="space-y-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
        <span class="field-label shrink-0 sm:w-20">Name</span>
        <InputText v-model="form.title" placeholder="Event name" class="flex-1 min-w-0" />
      </div>
      <DateTimeEditor
        v-model:startDate="form.start_date" v-model:endDate="form.end_date"
        v-model:startTime="form.start_time" v-model:endTime="form.end_time"
        v-model:isAllDay="form.is_all_day" :show-repeat="false"
        label="When" label-width="sm:w-20" row-padding="px-0 py-1" />
      <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
        <span class="field-label shrink-0 sm:w-20">Status</span>
        <Select v-model="form.status" :options="STATUS_OPTIONS" option-label="label" option-value="value" class="w-full sm:w-52" />
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
        <span class="field-label shrink-0 sm:w-20">Category</span>
        <Select v-model="form.category_id" :options="categories" option-label="name" option-value="id"
          placeholder="No category" show-clear filter class="w-full sm:w-64">
          <template #value="{ value }">
            <span v-if="value && categoriesById[value]" class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: categoriesById[value].color || '#94a3b8' }" />
              {{ categoriesById[value].name }}
            </span>
            <span v-else class="text-gray-400">No category</span>
          </template>
          <template #option="{ option }">
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ background: option.color || '#94a3b8' }" />
              {{ option.name }}
            </span>
          </template>
        </Select>
      </div>
      <div class="flex flex-col sm:flex-row sm:gap-4">
        <span class="field-label shrink-0 sm:w-20 sm:pt-2.5">Location</span>
        <div class="flex-1 min-w-0"><LocationEditor v-model="form.locations" :multi="false" /></div>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <Button label="Cancel" severity="secondary" text size="small" @click="editing = false" />
        <Button label="Save" icon="pi pi-check" size="small" :loading="saving" :disabled="!form.title.trim()"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="saveDetails" />
      </div>
    </div>
  </div>
</template>
