<!--
  PersonNotes — reusable notes affordance for a person, scoped to a context.

  Drop it anywhere you show a person (group roster, event invitees, people
  directory, booking, …). It renders a notes icon + count badge and owns the
  read/add/delete dialog. Notes are `person_notes` rows (migration 162/180) with
  a `links` array carrying the context, so every note also surfaces in the
  person's profile Notes feed.

  Props:
    person-id      (required) who the notes are about
    person-name    shown in the dialog header + tooltip
    links          context to attach to new notes AND scope the list by, e.g.
                   [{ type:'group', id, label }, { type:'term', id, label }].
                   The FIRST link is the scope: only notes carrying it show.
    scope-to-links default true — set false to show ALL of the person's notes
    initial-count  parent-supplied badge count (batch-loaded) to avoid N queries;
                   when omitted the component loads its own count on mount
    context-label  optional friendly context name for the header hint

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

const open = ref(false)
const notes = ref<any[]>([])
const newNote = ref('')
const saving = ref(false)
const loading = ref(false)
const count = ref<number>(props.initialCount ?? 0)

// Hover preview of the latest note (lazy-loaded on first hover).
const hovering = ref(false)
const latestNote = ref<string | null>(null)
const latestLoaded = ref(false)
const previewText = computed(() => notes.value[0]?.body ?? latestNote.value)

async function onHover() {
  hovering.value = true
  if (latestLoaded.value || notes.value.length || !count.value) return
  latestLoaded.value = true
  const { data } = await (db.from as any)('person_notes')
    .select('body, links, created_at').eq('person_id', props.personId).order('created_at', { ascending: false })
  const match = (data ?? []).find(matchesScope)
  latestNote.value = match?.body ?? null
}

// The scope link = the first provided link (e.g. the group). null = show all.
const scopeLink = computed<NoteLink | null>(() => props.scopeToLinks ? (props.links[0] ?? null) : null)
const matchesScope = (n: any) => {
  if (!scopeLink.value) return true
  return Array.isArray(n.links) && n.links.some((l: any) => l.type === scopeLink.value!.type && l.id === scopeLink.value!.id)
}

function setCount(v: number) { count.value = v; emit('count-change', v) }

async function loadCount() {
  if (props.initialCount != null) return  // parent supplied a batch count
  const { data } = await (db.from as any)('person_notes').select('id, links').eq('person_id', props.personId)
  setCount((data ?? []).filter(matchesScope).length)
}

async function openDialog() {
  open.value = true
  newNote.value = ''
  loading.value = true
  const { data } = await (db.from as any)('person_notes')
    .select('*').eq('person_id', props.personId).order('created_at', { ascending: false })
  notes.value = (data ?? []).filter(matchesScope)
  loading.value = false
  setCount(notes.value.length)
}

async function add() {
  const body = newNote.value.trim()
  if (!body) return
  saving.value = true
  const { data, error } = await (db.from as any)('person_notes').insert({
    org_id: orgId.value, person_id: props.personId, body, links: props.links ?? [],
    author_id: user.value?.id ?? null,
    author_name: (user.value?.user_metadata as any)?.full_name || user.value?.email || null,
  }).select('*').single()
  saving.value = false
  if (!error && data) { notes.value.unshift(data); newNote.value = ''; setCount(count.value + 1) }
}

async function remove(id: string) {
  await (db.from as any)('person_notes').delete().eq('id', id)
  notes.value = notes.value.filter(n => n.id !== id)
  setCount(Math.max(0, count.value - 1))
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

watch(() => props.initialCount, v => { if (v != null) count.value = v })
onMounted(loadCount)
</script>

<template>
  <span class="relative inline-flex">
    <slot name="trigger" :open="openDialog" :count="count">
      <button type="button" class="text-gray-400 hover:text-[#1976d2] relative"
        :title="personName ? `Notes for ${personName}` : 'Notes'"
        @click="openDialog" @mouseenter="onHover" @mouseleave="hovering = false">
        <i class="pi pi-comment text-base" />
        <span v-if="count" class="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-[#1976d2] text-white text-[9px] font-bold flex items-center justify-center">{{ count }}</span>
        <!-- latest-note hover preview -->
        <span v-if="hovering && previewText"
          class="absolute z-30 bottom-full right-0 mb-1.5 w-56 max-w-[70vw] text-left bg-gray-900 text-white text-[11px] leading-snug rounded-lg px-2.5 py-2 shadow-lg pointer-events-none">
          <span class="block text-[9px] uppercase tracking-wide text-white/50 mb-0.5">Latest note</span>
          <span class="line-clamp-4 whitespace-pre-wrap">{{ previewText }}</span>
        </span>
      </button>
    </slot>

    <Dialog v-model:visible="open" modal :style="{ width: '95vw', maxWidth: '520px' }"
      :header="personName ? `Notes — ${personName}` : 'Notes'">
      <div class="space-y-3">
        <p v-if="contextLabel" class="text-xs text-gray-500">
          Saved on {{ personName }} for <b>{{ contextLabel }}</b>. They also appear in the person's profile Notes.
        </p>
        <div class="flex flex-col gap-2">
          <Textarea v-model="newNote" rows="3" autoResize class="w-full" placeholder="Write a note…"
            @keydown.meta.enter="add" @keydown.ctrl.enter="add" />
          <div class="flex justify-end">
            <Button label="Add note" icon="pi pi-plus" :disabled="!newNote.trim() || saving"
              style="background:#1976d2;border-color:#1976d2" @click="add" />
          </div>
        </div>
        <div v-if="loading" class="text-sm text-gray-400 py-4 text-center">Loading…</div>
        <div v-else-if="!notes.length" class="text-sm text-gray-400 py-4 text-center">No notes yet.</div>
        <div v-else class="space-y-2 max-h-[45vh] overflow-y-auto">
          <div v-for="n in notes" :key="n.id" class="border border-gray-200 rounded-lg p-3">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm text-gray-800 whitespace-pre-wrap flex-1">{{ n.body }}</p>
              <button type="button" class="text-gray-300 hover:text-red-500 shrink-0" title="Delete note" @click="remove(n.id)">
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
            <div class="mt-1.5 text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
              <span>{{ fmtDate(n.created_at) }}</span>
              <span v-if="n.author_name">· {{ n.author_name }}</span>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  </span>
</template>
