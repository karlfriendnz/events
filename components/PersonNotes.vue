<!--
  PersonNotes — reusable notes affordance for a person, scoped to a context.

  Drop it anywhere you show a person (group roster, event invitees, people
  directory, booking, …). It renders a notes icon + count badge and opens a
  RIGHT-DOCKED SLIDE-OUT DRAWER (like <ReviewWidget>) that pushes the platform
  left and shows the person's COMPLETE note history. Notes are `person_notes`
  rows (migration 162/180) with a `links` array carrying the context, so every
  note also surfaces in the person's profile Notes feed.

  Props:
    person-id      (required) who the notes are about
    person-name    shown in the drawer header + tooltip
    links          context to attach to new notes AND scope the BADGE by, e.g.
                   [{ type:'group', id, label }, { type:'term', id, label }].
                   links[0] is the scope for the count; the drawer shows all
                   of the person's notes (full history) with context chips.
    scope-to-links default true — set false to also count ALL notes
    initial-count  parent-supplied badge count (batch-loaded) to avoid N queries
    context-label  friendly context name for the drawer header + note attach

  Slots:
    trigger({ open, count }) — replace the default icon button
-->
<script setup lang="ts">
type NoteLink = { type: string; id: string; label?: string }

const props = withDefaults(defineProps<{
  personId: string
  personName?: string
  links?: NoteLink[]
  scopeToLinks?: boolean
  initialCount?: number | null
  contextLabel?: string
  canEditAll?: boolean    // true when the viewer may edit anyone's notes here
  canDeleteAll?: boolean  // true when the viewer has permission to delete notes
}>(), { personName: '', links: () => [], scopeToLinks: true, initialCount: null, contextLabel: '', canEditAll: false, canDeleteAll: false })

const emit = defineEmits<{ (e: 'count-change', v: number): void }>()

const { orgId } = useOrg()
const user = useSupabaseUser()
const peopleApi = usePeopleApi()
const circlesApi = useCirclesApi()

// The seam returns camelCase notes; this component's template + matchesScope/startEdit
// read snake_case. Map at the boundary so nothing else changes.
function toRow(n: any) {
  return {
    id: n.id,
    org_id: n.orgId,
    person_id: n.personId,
    body: n.body,
    tags: n.tags ?? [],
    channel: n.channel ?? null,
    author_id: n.authorId ?? null,
    author_name: n.authorName ?? null,
    links: Array.isArray(n.links) ? n.links : [],
    visibility: n.visibility ?? 'staff',
    visible_to: Array.isArray(n.visibleTo) ? n.visibleTo : [],
    is_important: !!n.isImportant,
    due_date: n.dueDate ?? null,
    created_at: n.createdAt,
  }
}

// One drawer at a time across every instance; also drives the layout push.
const uid = `pn-${((globalThis as any).__pnSeq = (((globalThis as any).__pnSeq || 0) + 1))}`
const activePanel = usePersonNotesPanel()
const open = computed(() => activePanel.value === uid)

const notes = ref<any[]>([])     // full history for the drawer
const newNote = ref('')
const saving = ref(false)
const loading = ref(false)
const count = ref<number>(props.initialCount ?? 0)   // scoped badge count

// New-note options — who can see it (multi-select) + important flag.
const aud = useNoteAudiences()
const noteAudiences = ref<string[]>(['staff'])
const noteImportant = ref(false)
const noteDue = ref<Date | null>(null)
// How the interaction happened (in person / phone / email…), migration 224.
const { NOTE_CHANNELS, channelLabel, channelIcon } = useNoteChannels()
const noteChannel = ref<string | null>(null)

// The subject's parents/contacts — lazy-loaded so a "specific parent" can be
// picked in the same audience multi-select (value `person:<id>`).
const parents = ref<import('~/composables/useNoteAudiences').NoteParent[]>([])
const parentsLoaded = ref(false)
const audienceOptions = computed(() => aud.audienceOptions(parents.value))

async function loadParents() {
  if (parentsLoaded.value) return
  parentsLoaded.value = true
  parents.value = await aud.loadParents(props.personId)
}
const buildVisibleTo = () => aud.buildVisibleTo(noteAudiences.value, parents.value)
const visibleToLabels = (n: any) => aud.visibleToLabels(n.visible_to, n.visibility)

// Hover preview of the latest in-context note (lazy-loaded on first hover).
const hovering = ref(false)
const latestNote = ref<string | null>(null)
const latestLoaded = ref(false)
const previewText = computed(() => latestNote.value)

const scopeLink = computed<NoteLink | null>(() => props.scopeToLinks ? (props.links[0] ?? null) : null)
const matchesScope = (n: any) => {
  if (!scopeLink.value) return true
  return Array.isArray(n.links) && n.links.some((l: any) => l.type === scopeLink.value!.type && l.id === scopeLink.value!.id)
}
function setCount(v: number) { count.value = v; emit('count-change', v) }

async function loadCount() {
  if (props.initialCount != null) return
  const rows = (await circlesApi.notes(props.personId)).map(toRow)
  setCount(rows.filter(matchesScope).length)
}

async function onHover() {
  hovering.value = true
  if (latestLoaded.value || !count.value) return
  latestLoaded.value = true
  // Seam returns newest-first.
  const rows = (await circlesApi.notes(props.personId)).map(toRow)
  latestNote.value = rows.find(matchesScope)?.body ?? null
}

async function openDrawer() {
  activePanel.value = uid
  hovering.value = false
  newNote.value = ''
  noteAudiences.value = ['staff']
  noteImportant.value = false
  noteDue.value = null
  loadParents()
  loading.value = true
  notes.value = (await circlesApi.notes(props.personId)).map(toRow)
  loading.value = false
  setCount(notes.value.filter(matchesScope).length)
}
function closeDrawer() { if (open.value) activePanel.value = null }

async function add() {
  const body = newNote.value.trim()
  if (!body) return
  saving.value = true
  try {
    const created = await peopleApi.addNote({
      orgId: orgId.value!, personId: props.personId, body, links: props.links ?? [], channel: noteChannel.value,
      visibleTo: buildVisibleTo(), visibility: noteAudiences.value[0] || 'staff', isImportant: noteImportant.value,
      dueDate: aud.toISODate(noteDue.value),
      authorId: user.value?.id ?? null,
      authorName: (user.value?.user_metadata as any)?.full_name || user.value?.email || null,
    })
    const row = toRow(created)
    notes.value.unshift(row)
    newNote.value = ''
    noteAudiences.value = ['staff']
    noteImportant.value = false
    noteDue.value = null
    noteChannel.value = null
    latestNote.value = body
    if (matchesScope(row)) setCount(count.value + 1)
  } finally {
    saving.value = false
  }
}

async function remove(n: any) {
  await peopleApi.removeNote(n.id)
  notes.value = notes.value.filter(x => x.id !== n.id)
  if (matchesScope(n)) setCount(Math.max(0, count.value - 1))
}

// Edit — allowed for the note's author, or anyone with edit permission here.
const canEditNote = (n: any) => props.canEditAll || (!!n.author_id && n.author_id === user.value?.id)
const editingId = ref<string | null>(null)
const editBody = ref('')
const editAudiences = ref<string[]>([])
const editImportant = ref(false)
const editDue = ref<Date | null>(null)
const tokensFromVisibleTo = (vt: any) => (Array.isArray(vt) ? vt : []).map((a: any) => a.type === 'person' ? `person:${a.id}` : a.type)
function startEdit(n: any) {
  editingId.value = n.id
  editBody.value = n.body
  editAudiences.value = tokensFromVisibleTo(n.visible_to)
  editImportant.value = !!n.is_important
  editDue.value = n.due_date ? new Date(n.due_date + 'T00:00:00') : null
}
function cancelEdit() { editingId.value = null }
async function saveEdit(n: any) {
  const body = editBody.value.trim()
  if (!body) return
  const visibleTo = aud.buildVisibleTo(editAudiences.value, parents.value)
  const visibility = editAudiences.value[0] || 'staff'
  const isImportant = editImportant.value
  const dueDate = aud.toISODate(editDue.value)
  try {
    await peopleApi.updateNote(n.id, { body, visibleTo, visibility, isImportant, dueDate })
    // Keep the local row's snake_case shape the template reads.
    Object.assign(n, { body, visible_to: visibleTo, visibility, is_important: isImportant, due_date: dueDate })
    editingId.value = null
  } catch {}
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

watch(() => props.initialCount, v => { if (v != null) count.value = v })
onMounted(loadCount)
onBeforeUnmount(() => { if (open.value) activePanel.value = null })
</script>

<template>
  <span class="relative inline-flex">
    <slot name="trigger" :open="openDrawer" :count="count">
      <button type="button" class="text-gray-400 hover:text-[#1976d2] relative"
        :title="personName ? `Notes for ${personName}` : 'Notes'"
        @click="openDrawer" @mouseenter="onHover" @mouseleave="hovering = false">
        <i class="pi pi-comment text-base" />
        <span v-if="count" class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1976d2] text-white text-[9px] font-bold flex items-center justify-center">{{ count }}</span>
        <span v-if="hovering && previewText"
          class="absolute z-30 bottom-full right-0 mb-1.5 w-56 max-w-[70vw] text-left bg-gray-900 text-white text-[11px] leading-snug rounded-lg px-2.5 py-2 shadow-lg pointer-events-none">
          <span class="block text-[9px] uppercase tracking-wide text-white/50 mb-0.5">Latest note</span>
          <span class="line-clamp-4 whitespace-pre-wrap">{{ previewText }}</span>
        </span>
      </button>
    </slot>

    <Teleport to="body">
      <Transition name="pn-drawer">
        <div v-if="open" class="fixed top-0 right-0 bottom-0 w-full md:w-[440px] bg-white border-l border-gray-200 shadow-2xl z-[60] flex flex-col">
          <!-- header -->
          <div class="h-14 shrink-0 border-b border-gray-200 flex items-center justify-between px-4 gap-2">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-gray-800 truncate">Notes — {{ personName || 'Person' }}</div>
              <div v-if="contextLabel" class="text-[11px] text-gray-400 truncate">{{ contextLabel }}</div>
            </div>
            <button type="button" class="text-gray-400 hover:text-gray-700 shrink-0" title="Close" @click="closeDrawer">
              <i class="pi pi-times text-base" />
            </button>
          </div>
          <!-- composer -->
          <div class="p-4 border-b border-gray-100 space-y-2">
            <Textarea v-model="newNote" rows="3" autoResize class="w-full" placeholder="Write a note…"
              @keydown.meta.enter="add" @keydown.ctrl.enter="add" />
            <div class="flex items-center gap-2">
              <span class="text-[11px] font-semibold text-gray-400 shrink-0">Show to</span>
              <MultiSelect v-model="noteAudiences" :options="audienceOptions" optionLabel="label" optionValue="value"
                optionGroupLabel="label" optionGroupChildren="items"
                display="chip" placeholder="Choose audiences" size="small" class="flex-1 min-w-0" :showToggleAll="false" />
            </div>
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <div class="flex items-center gap-2">
                <button type="button" @click="noteImportant = !noteImportant"
                  class="inline-flex items-center gap-1 text-xs font-semibold rounded px-2 py-1.5 border"
                  :class="noteImportant ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'"
                  title="Flag as important">
                  <i class="pi text-[11px]" :class="noteImportant ? 'pi-flag-fill' : 'pi-flag'" /> Important
                </button>
                <DatePicker v-model="noteDue" dateFormat="d M yy" showButtonBar placeholder="Due date" size="small" class="w-36" showIcon iconDisplay="input" />
                <Select v-model="noteChannel" :options="NOTE_CHANNELS" optionLabel="label" optionValue="value"
                  placeholder="How" showClear size="small" class="w-36">
                  <template #option="{ option }"><i :class="['pi', option.icon, 'text-xs mr-2 text-gray-400']" />{{ option.label }}</template>
                </Select>
              </div>
              <Button label="Add note" icon="pi pi-plus" size="small" :disabled="!newNote.trim() || saving"
                style="background:#1976d2;border-color:#1976d2" @click="add" />
            </div>
          </div>
          <!-- full history -->
          <div class="flex-1 overflow-y-auto p-4 space-y-2">
            <div v-if="loading" class="text-sm text-gray-400 py-6 text-center">Loading…</div>
            <div v-else-if="!notes.length" class="text-sm text-gray-400 py-6 text-center">No notes yet.</div>
            <div v-for="n in notes" :key="n.id" class="border rounded-lg p-3"
              :class="[matchesScope(n) ? '' : 'opacity-70', n.is_important ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200']">
              <!-- edit mode -->
              <div v-if="editingId === n.id" class="space-y-2">
                <Textarea v-model="editBody" rows="3" autoResize class="w-full" placeholder="Note…" />
                <MultiSelect v-model="editAudiences" :options="audienceOptions" optionLabel="label" optionValue="value"
                  optionGroupLabel="label" optionGroupChildren="items" display="chip" placeholder="Show to…"
                  size="small" class="w-full" :showToggleAll="false" />
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-2">
                    <button type="button" @click="editImportant = !editImportant"
                      class="inline-flex items-center gap-1 text-xs font-semibold rounded px-2 py-1.5 border"
                      :class="editImportant ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'">
                      <i class="pi text-[11px]" :class="editImportant ? 'pi-flag-fill' : 'pi-flag'" /> Important
                    </button>
                    <DatePicker v-model="editDue" dateFormat="d M yy" showButtonBar placeholder="Due date" size="small" class="w-36" showIcon iconDisplay="input" />
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" class="text-xs font-semibold text-gray-500 hover:text-gray-700" @click="cancelEdit">Cancel</button>
                    <Button label="Save" size="small" :disabled="!editBody.trim()" style="background:#1976d2;border-color:#1976d2" @click="saveEdit(n)" />
                  </div>
                </div>
              </div>
              <!-- display mode -->
              <template v-else>
                <div class="flex items-start justify-between gap-2">
                  <p class="text-sm text-gray-800 whitespace-pre-wrap flex-1">
                    <i v-if="n.is_important" class="pi pi-flag-fill text-amber-500 text-[11px] mr-1" title="Important" />{{ n.body }}
                  </p>
                  <div v-if="canEditNote(n) || canDeleteAll" class="flex items-center gap-2 shrink-0">
                    <button v-if="canEditNote(n)" type="button" class="text-gray-300 hover:text-[#1976d2]" title="Edit note" @click="startEdit(n)">
                      <i class="pi pi-pencil text-xs" />
                    </button>
                    <button v-if="canDeleteAll" type="button" class="text-gray-300 hover:text-red-500" title="Delete note" @click="remove(n)">
                      <i class="pi pi-trash text-xs" />
                    </button>
                  </div>
                </div>
                <div v-if="Array.isArray(n.links) && n.links.length" class="flex flex-wrap gap-1 mt-1.5">
                  <span v-for="(l, li) in n.links" :key="li" class="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{{ l.label || l.type }}</span>
                </div>
                <div v-if="visibleToLabels(n).length || n.due_date" class="mt-1.5 flex items-center gap-1 flex-wrap">
                  <template v-if="visibleToLabels(n).length">
                    <i class="pi pi-eye text-[10px] text-gray-400" />
                    <span v-for="(lbl, li) in visibleToLabels(n)" :key="li" class="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">{{ lbl }}</span>
                  </template>
                  <span v-if="n.due_date" class="text-[10px] rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                    :class="aud.isOverdue(n.due_date) ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'">
                    <i class="pi pi-clock text-[9px]" />{{ aud.dueLabel(n.due_date) }}
                  </span>
                </div>
                <div class="mt-1.5 text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                  <span v-if="n.channel" class="rounded px-1.5 py-0.5 bg-gray-100 text-gray-600 inline-flex items-center gap-1">
                    <i :class="['pi', channelIcon(n.channel), 'text-[9px]']" />{{ channelLabel(n.channel) }}
                  </span>
                  <span>{{ fmtDate(n.created_at) }}</span>
                  <span v-if="n.author_name">· {{ n.author_name }}</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </span>
</template>

<style scoped>
.pn-drawer-enter-active,
.pn-drawer-leave-active { transition: transform 0.3s ease; }
.pn-drawer-enter-from,
.pn-drawer-leave-to { transform: translateX(100%); }
</style>
