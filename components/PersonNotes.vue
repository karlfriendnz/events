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
}>(), { personName: '', links: () => [], scopeToLinks: true, initialCount: null, contextLabel: '' })

const emit = defineEmits<{ (e: 'count-change', v: number): void }>()

const db = useDb()
const { orgId } = useOrg()
const user = useSupabaseUser()

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
  const { data } = await (db.from as any)('person_notes').select('id, links').eq('person_id', props.personId)
  setCount((data ?? []).filter(matchesScope).length)
}

async function onHover() {
  hovering.value = true
  if (latestLoaded.value || !count.value) return
  latestLoaded.value = true
  const { data } = await (db.from as any)('person_notes')
    .select('body, links, created_at').eq('person_id', props.personId).order('created_at', { ascending: false })
  latestNote.value = (data ?? []).find(matchesScope)?.body ?? null
}

async function openDrawer() {
  activePanel.value = uid
  hovering.value = false
  newNote.value = ''
  noteAudiences.value = ['staff']
  noteImportant.value = false
  loadParents()
  loading.value = true
  const { data } = await (db.from as any)('person_notes')
    .select('*').eq('person_id', props.personId).order('created_at', { ascending: false })
  notes.value = data ?? []
  loading.value = false
  setCount(notes.value.filter(matchesScope).length)
}
function closeDrawer() { if (open.value) activePanel.value = null }

async function add() {
  const body = newNote.value.trim()
  if (!body) return
  saving.value = true
  const { data, error } = await (db.from as any)('person_notes').insert({
    org_id: orgId.value, person_id: props.personId, body, links: props.links ?? [],
    visible_to: buildVisibleTo(), visibility: noteAudiences.value[0] || 'staff', is_important: noteImportant.value,
    author_id: user.value?.id ?? null,
    author_name: (user.value?.user_metadata as any)?.full_name || user.value?.email || null,
  }).select('*').single()
  saving.value = false
  if (!error && data) {
    notes.value.unshift(data)
    newNote.value = ''
    noteAudiences.value = ['staff']
    noteImportant.value = false
    latestNote.value = body
    if (matchesScope(data)) setCount(count.value + 1)
  }
}

async function remove(n: any) {
  await (db.from as any)('person_notes').delete().eq('id', n.id)
  notes.value = notes.value.filter(x => x.id !== n.id)
  if (matchesScope(n)) setCount(Math.max(0, count.value - 1))
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
              <button type="button" @click="noteImportant = !noteImportant"
                class="inline-flex items-center gap-1 text-xs font-semibold rounded px-2 py-1.5 border"
                :class="noteImportant ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'"
                title="Flag as important">
                <i class="pi text-[11px]" :class="noteImportant ? 'pi-flag-fill' : 'pi-flag'" /> Important
              </button>
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
              <div class="flex items-start justify-between gap-2">
                <p class="text-sm text-gray-800 whitespace-pre-wrap flex-1">
                  <i v-if="n.is_important" class="pi pi-flag-fill text-amber-500 text-[11px] mr-1" title="Important" />{{ n.body }}
                </p>
                <button type="button" class="text-gray-300 hover:text-red-500 shrink-0" title="Delete note" @click="remove(n)">
                  <i class="pi pi-trash text-xs" />
                </button>
              </div>
              <div v-if="Array.isArray(n.links) && n.links.length" class="flex flex-wrap gap-1 mt-1.5">
                <span v-for="(l, li) in n.links" :key="li" class="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{{ l.label || l.type }}</span>
              </div>
              <div v-if="visibleToLabels(n).length" class="mt-1.5 flex items-center gap-1 flex-wrap">
                <i class="pi pi-eye text-[10px] text-gray-400" />
                <span v-for="(lbl, li) in visibleToLabels(n)" :key="li" class="text-[10px] bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">{{ lbl }}</span>
              </div>
              <div class="mt-1.5 text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                <span>{{ fmtDate(n.created_at) }}</span>
                <span v-if="n.author_name">· {{ n.author_name }}</span>
              </div>
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
