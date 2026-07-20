<!--
  Reusable Notes & Tasks panel for an event — the full-featured version (tasks with
  inline edit, done, volunteer-role slots, assignees + people picker; rich-text notes).
  Self-contained by `event-id`: loads/writes its own tasks + notes via the useEventsApi
  seam and its own org-people list (usePeopleApi) for assignees. Used by the full event
  editor's Notes tab AND the simple run-the-event view, so both share one implementation.
-->
<script setup lang="ts">
const props = defineProps<{ eventId: string }>()

const eventsApi = useEventsApi()
const peopleApi = usePeopleApi()
const { orgId } = useOrg()

const _camelToSnake = (k: string) => k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())
const snakeRow = (o: Record<string, any>): any =>
  Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [_camelToSnake(k), v]))

// ── Notes ──
const eventNotes = ref<{ id: string; title: string | null; content: string; created_at: string }[]>([])
const editingNoteId = ref<string | null>(null)
const newNoteMode = ref(false)
const editingNoteTitle = ref('')
const editingNoteContent = ref('')
const savingNote = ref(false)

async function loadEventNotes() {
  eventNotes.value = (await eventsApi.notes(props.eventId)).map(snakeRow)
}
function startNewNote() {
  editingNoteId.value = null
  editingNoteTitle.value = ''
  editingNoteContent.value = ''
  newNoteMode.value = true
}
function cancelNoteEdit() {
  editingNoteId.value = null
  newNoteMode.value = false
}
async function saveNewNote() {
  savingNote.value = true
  const data = snakeRow(await eventsApi.createNote(props.eventId, {
    title: editingNoteTitle.value.trim() || null,
    content: editingNoteContent.value,
  } as any))
  if (data) eventNotes.value.push(data)
  newNoteMode.value = false
  savingNote.value = false
}
function startEditNote(note: any) {
  editingNoteId.value = note.id
  editingNoteTitle.value = note.title ?? ''
  editingNoteContent.value = note.content
  newNoteMode.value = false
}
async function saveNoteEdit() {
  if (!editingNoteId.value) return
  savingNote.value = true
  await eventsApi.updateNote(editingNoteId.value, {
    title: editingNoteTitle.value.trim() || null,
    content: editingNoteContent.value,
  } as any)
  const note = eventNotes.value.find(n => n.id === editingNoteId.value)
  if (note) { note.title = editingNoteTitle.value.trim() || null; note.content = editingNoteContent.value }
  editingNoteId.value = null
  savingNote.value = false
}
async function deleteEventNote(noteId: string) {
  await eventsApi.removeNote(noteId)
  eventNotes.value = eventNotes.value.filter(n => n.id !== noteId)
}

// ── Tasks ──
const eventTasks = ref<{ id: string; text: string; done: boolean; due_date: string | null; assignee_ids: string[]; is_role: boolean; role_capacity: number }[]>([])
const newTaskText = ref('')
const editingTaskId = ref<string | null>(null)
const editingTaskText = ref('')
const taskPersonPickerOpen = ref<string | null>(null)
const taskPersonSearch = ref('')
const orgPersons = ref<{ id: string; first_name: string; last_name: string }[]>([])
const orgPersonsLoaded = ref(false)

const filteredTaskPersons = computed(() => {
  const q = taskPersonSearch.value.toLowerCase()
  return q ? orgPersons.value.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) : orgPersons.value
})
function personInitials(personId: string) {
  const p = orgPersons.value.find(x => x.id === personId)
  return p ? `${p.first_name[0]}${p.last_name[0]}`.toUpperCase() : '?'
}
function personName(personId: string) {
  const p = orgPersons.value.find(x => x.id === personId)
  return p ? `${p.first_name} ${p.last_name}` : ''
}
async function loadOrgPersons() {
  if (orgPersonsLoaded.value || !orgId.value) return
  orgPersonsLoaded.value = true
  orgPersons.value = (await peopleApi.list(orgId.value))
    .map((p: any) => ({ id: p.id, first_name: p.firstName, last_name: p.lastName }))
    .sort((a, b) => a.first_name.localeCompare(b.first_name))
}
async function loadTasks() {
  const data = (await eventsApi.tasks(props.eventId)).map(snakeRow)
  eventTasks.value = data.map((t: any) => ({ ...t, assignee_ids: t.assignee_ids ?? [], is_role: t.is_role ?? false, role_capacity: t.role_capacity ?? 1 }))
  loadOrgPersons()
}
async function addTask() {
  const text = newTaskText.value.trim()
  if (!text) return
  const data = snakeRow(await eventsApi.createTask(props.eventId, { text, done: false, assigneeIds: [], isRole: false, roleCapacity: 1 } as any))
  if (data) eventTasks.value.push({ ...data, assignee_ids: data.assignee_ids ?? [], is_role: false, role_capacity: 1 })
  newTaskText.value = ''
}
async function toggleTask(task: any) {
  const done = !task.done
  await eventsApi.updateTask(task.id, { done })
  task.done = done
}
function startEditTask(task: any) {
  editingTaskId.value = task.id
  editingTaskText.value = task.text
}
async function saveTaskEdit(task: any) {
  const text = editingTaskText.value.trim()
  if (!text) { editingTaskId.value = null; return }
  await eventsApi.updateTask(task.id, { text })
  task.text = text
  editingTaskId.value = null
}
async function deleteTask(taskId: string) {
  await eventsApi.removeTask(taskId)
  eventTasks.value = eventTasks.value.filter(t => t.id !== taskId)
}
function formatTaskDate(date: string) {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}
async function toggleTaskAssignee(task: any, personId: string) {
  const ids: string[] = task.assignee_ids ?? []
  const newIds = ids.includes(personId) ? ids.filter((pid: string) => pid !== personId) : [...ids, personId]
  await eventsApi.updateTask(task.id, { assigneeIds: newIds })
  task.assignee_ids = newIds
}
function toggleTaskPersonPicker(taskId: string) {
  if (taskPersonPickerOpen.value === taskId) {
    taskPersonPickerOpen.value = null
  } else {
    taskPersonSearch.value = ''
    taskPersonPickerOpen.value = taskId
    loadOrgPersons()
  }
}
async function toggleTaskRole(task: any) {
  const is_role = !task.is_role
  await eventsApi.updateTask(task.id, { isRole: is_role })
  task.is_role = is_role
}
async function updateTaskCapacity(task: any, delta: number) {
  const newCap = Math.max(1, (task.role_capacity ?? 1) + delta)
  await eventsApi.updateTask(task.id, { roleCapacity: newCap })
  task.role_capacity = newCap
}
function taskFillStatus(task: any) {
  const filled = (task.assignee_ids ?? []).length
  const cap = task.role_capacity ?? 1
  return { isFilled: filled >= cap, label: filled >= cap ? 'Filled' : `${filled}/${cap} filled` }
}
function emptySlotArray(task: any): number[] {
  const filled = (task.assignee_ids ?? []).length
  const cap = task.role_capacity ?? 1
  return Array.from({ length: Math.min(4, Math.max(0, cap - filled)) }, (_, i) => i)
}

async function load() {
  await Promise.all([loadTasks(), loadEventNotes()])
}
onMounted(load)
watch(() => props.eventId, () => { orgPersonsLoaded.value = false; load() })
defineExpose({ reload: load })
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-start">

    <!-- Tasks (left, 50%) -->
    <div class="w-full sm:w-1/2 min-w-0 bg-white rounded-xl border border-gray-200">
      <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <p class="text-sm font-semibold text-gray-800">Tasks</p>
          <span v-if="eventTasks.length" class="text-xs text-gray-400">({{ eventTasks.filter(t => t.done).length }}/{{ eventTasks.length }} done)</span>
        </div>
      </div>

      <div v-if="eventTasks.length" class="p-3 space-y-2">
        <div v-for="task in eventTasks" :key="task.id" class="rounded-lg border border-gray-200 bg-white">

          <!-- Title row -->
          <div class="flex items-start gap-3 px-4 py-3">
            <button class="shrink-0 mt-0.5" @click="toggleTask(task)">
              <i :class="`pi text-base ${task.done ? 'pi-check-circle text-green-500' : 'pi-circle text-gray-300 hover:text-gray-400'}`" />
            </button>
            <div class="flex-1 min-w-0">
              <input v-if="editingTaskId === task.id" v-model="editingTaskText"
                class="w-full text-sm text-gray-800 border-0 outline-none bg-transparent p-0 focus:ring-0"
                @keydown.enter="saveTaskEdit(task)" @keydown.escape="editingTaskId = null" @blur="saveTaskEdit(task)" autofocus />
              <p v-else class="text-sm cursor-text" :class="task.done ? 'line-through text-gray-400' : 'text-gray-800 font-medium'" @click="startEditTask(task)">
                {{ task.text }}
              </p>
              <p v-if="task.due_date" class="text-xs text-gray-400 mt-0.5">Due {{ formatTaskDate(task.due_date) }}</p>
            </div>
            <button class="shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5" @click="deleteTask(task.id)">
              <i class="pi pi-trash text-xs" />
            </button>
          </div>

          <!-- Properties strip -->
          <div class="border-t border-gray-100 bg-gray-50 px-4 py-2.5 flex items-center gap-4 flex-wrap"
            :class="!task.is_role && !task.assignee_ids.length ? 'rounded-b-lg' : ''">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <div class="relative w-7 h-4 shrink-0" @click="toggleTaskRole(task)">
                <div class="w-7 h-4 rounded-full transition-colors" :class="task.is_role ? 'bg-primary' : 'bg-gray-300'" />
                <div class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform" :class="task.is_role ? 'translate-x-3' : 'translate-x-0'" />
              </div>
              <span class="text-xs text-gray-600">Volunteer role</span>
            </label>

            <template v-if="task.is_role">
              <span class="w-px h-4 bg-gray-200 shrink-0" />
              <div class="flex items-center gap-1.5">
                <span class="text-xs text-gray-500">Slots needed</span>
                <div class="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-1.5 py-0.5">
                  <button class="text-gray-400 hover:text-gray-700 w-4 h-4 flex items-center justify-center transition-colors" @click="updateTaskCapacity(task, -1)">
                    <i class="pi pi-minus" style="font-size:8px" />
                  </button>
                  <span class="text-xs text-gray-700 font-medium tabular-nums w-4 text-center">{{ task.role_capacity }}</span>
                  <button class="text-gray-400 hover:text-gray-700 w-4 h-4 flex items-center justify-center transition-colors" @click="updateTaskCapacity(task, 1)">
                    <i class="pi pi-plus" style="font-size:8px" />
                  </button>
                </div>
              </div>
              <span class="text-xs font-medium" :class="taskFillStatus(task).isFilled ? 'text-green-600' : 'text-amber-600'">
                <i :class="`pi mr-1 ${taskFillStatus(task).isFilled ? 'pi-check-circle' : 'pi-exclamation-circle'}`" style="font-size:10px" />
                {{ taskFillStatus(task).label }}
              </span>
            </template>
          </div>

          <!-- People row (role or has assignees) -->
          <div v-if="task.is_role || task.assignee_ids.length" class="border-t border-gray-100 px-4 py-2.5 flex items-center gap-2 flex-wrap rounded-b-lg">
            <span class="text-xs text-gray-400 shrink-0">{{ task.is_role ? 'Volunteers' : 'Assigned to' }}</span>

            <span v-for="pid in task.assignee_ids" :key="pid" class="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/15 rounded-full pl-1.5 pr-2 py-0.5">
              <span class="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center shrink-0" style="font-size:8px;font-weight:700">{{ personInitials(pid) }}</span>
              <span class="text-xs text-gray-700">{{ personName(pid) }}</span>
              <button class="text-gray-300 hover:text-red-400 transition-colors ml-0.5" @click="toggleTaskAssignee(task, pid)">
                <i class="pi pi-times" style="font-size:8px" />
              </button>
            </span>

            <span v-if="task.is_role" v-for="n in emptySlotArray(task)" :key="`e${n}`" class="inline-flex items-center gap-1 border border-dashed border-gray-300 rounded-full px-2 py-0.5">
              <span class="text-xs text-gray-300">Empty slot</span>
            </span>

            <div class="relative">
              <button class="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/70 font-medium transition-colors" @click.stop="toggleTaskPersonPicker(task.id)">
                <i class="pi pi-plus-circle" style="font-size:11px" />
                {{ task.is_role ? 'Add volunteer' : 'Add person' }}
              </button>
              <div v-if="taskPersonPickerOpen === task.id" class="absolute left-0 top-6 z-50 bg-white rounded-lg shadow-lg border border-gray-200 w-52" @click.stop>
                <div class="px-2.5 py-2 border-b border-gray-100">
                  <input v-model="taskPersonSearch" placeholder="Search people…" autofocus class="w-full text-xs border-0 outline-none bg-transparent p-0 focus:ring-0 placeholder-gray-300" />
                </div>
                <div class="max-h-48 overflow-y-auto py-1">
                  <div v-if="!filteredTaskPersons.length" class="px-3 py-2 text-xs text-gray-400 italic">No people found</div>
                  <button v-for="person in filteredTaskPersons" :key="person.id" class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 text-left transition-colors" @click.stop="toggleTaskAssignee(task, person.id)">
                    <span class="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0" style="font-size:9px;font-weight:700">{{ person.first_name[0] }}{{ person.last_name[0] }}</span>
                    <span class="flex-1 truncate text-gray-700">{{ person.first_name }} {{ person.last_name }}</span>
                    <i v-if="task.assignee_ids.includes(person.id)" class="pi pi-check text-primary" style="font-size:10px" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Add people row trigger (no role, no assignees) -->
          <div v-else class="border-t border-gray-100 px-4 py-2 relative rounded-b-lg">
            <button class="text-xs text-gray-400 hover:text-primary transition-colors" @click.stop="toggleTaskPersonPicker(task.id)">
              <i class="pi pi-user-plus mr-1" style="font-size:10px" />Assign someone
            </button>
            <div v-if="taskPersonPickerOpen === task.id" class="absolute left-4 top-8 z-50 bg-white rounded-lg shadow-lg border border-gray-200 w-52" @click.stop>
              <div class="px-2.5 py-2 border-b border-gray-100">
                <input v-model="taskPersonSearch" placeholder="Search people…" autofocus class="w-full text-xs border-0 outline-none bg-transparent p-0 focus:ring-0 placeholder-gray-300" />
              </div>
              <div class="max-h-48 overflow-y-auto py-1">
                <div v-if="!filteredTaskPersons.length" class="px-3 py-2 text-xs text-gray-400 italic">No people found</div>
                <button v-for="person in filteredTaskPersons" :key="person.id" class="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 text-left transition-colors" @click.stop="toggleTaskAssignee(task, person.id)">
                  <span class="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center shrink-0" style="font-size:9px;font-weight:700">{{ person.first_name[0] }}{{ person.last_name[0] }}</span>
                  <span class="flex-1 truncate text-gray-700">{{ person.first_name }} {{ person.last_name }}</span>
                  <i v-if="task.assignee_ids.includes(person.id)" class="pi pi-check text-primary" style="font-size:10px" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
      <div v-else class="px-5 py-6 text-center text-sm text-gray-400">No tasks yet</div>

      <!-- Add task input -->
      <div class="px-5 py-3 border-t border-gray-100">
        <div class="flex items-center gap-2">
          <i class="pi pi-plus text-gray-300 text-xs shrink-0" />
          <input v-model="newTaskText" placeholder="Add a task…" class="flex-1 text-sm text-gray-700 border-0 outline-none bg-transparent p-0 focus:ring-0 placeholder-gray-300" @keydown.enter="addTask" />
          <button v-if="newTaskText.trim()" class="text-xs font-semibold text-primary hover:underline shrink-0" @click="addTask">Add</button>
        </div>
      </div>
    </div><!-- /tasks -->

    <!-- Notes (right, 50%) -->
    <div class="w-full sm:w-1/2 min-w-0 bg-white rounded-xl border border-gray-200">
      <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <p class="text-sm font-semibold text-gray-800">Notes</p>
        <button class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" @click="startNewNote">
          <i class="pi pi-plus" style="font-size:10px" /> Add note
        </button>
      </div>

      <!-- New note form -->
      <div v-if="newNoteMode" class="p-4 border-b border-gray-100 space-y-3">
        <input v-model="editingNoteTitle" placeholder="Title (optional)" class="w-full text-sm font-semibold text-gray-800 border-0 outline-none bg-transparent p-0 placeholder-gray-300 focus:ring-0" />
        <RichTextEditor v-model="editingNoteContent" placeholder="Write your note…" />
        <div class="flex items-center gap-3 pt-1">
          <button class="text-xs text-gray-400 hover:text-gray-600" @click="cancelNoteEdit">Cancel</button>
          <button class="text-xs font-semibold text-primary hover:underline" :disabled="savingNote" @click="saveNewNote">{{ savingNote ? 'Saving…' : 'Save note' }}</button>
        </div>
      </div>

      <!-- Existing notes -->
      <div v-if="eventNotes.length" class="divide-y divide-gray-100">
        <div v-for="note in eventNotes" :key="note.id" class="p-4">
          <template v-if="editingNoteId === note.id">
            <input v-model="editingNoteTitle" placeholder="Title (optional)" class="w-full text-sm font-semibold text-gray-800 border-0 outline-none bg-transparent p-0 mb-3 placeholder-gray-300 focus:ring-0" />
            <RichTextEditor v-model="editingNoteContent" placeholder="Write your note…" />
            <div class="flex items-center gap-3 mt-3">
              <button class="text-xs text-gray-400 hover:text-gray-600" @click="cancelNoteEdit">Cancel</button>
              <button class="text-xs font-semibold text-primary hover:underline" :disabled="savingNote" @click="saveNoteEdit">{{ savingNote ? 'Saving…' : 'Save' }}</button>
            </div>
          </template>
          <template v-else>
            <div class="flex items-start justify-between gap-2 mb-2">
              <p v-if="note.title" class="text-sm font-semibold text-gray-800">{{ note.title }}</p>
              <div class="flex items-center gap-2 ml-auto shrink-0">
                <button class="text-xs text-primary hover:underline" @click="startEditNote(note)">Edit</button>
                <button class="text-gray-300 hover:text-red-400 transition-colors" @click="deleteEventNote(note.id)"><i class="pi pi-trash text-xs" /></button>
              </div>
            </div>
            <div v-if="note.content" class="prose prose-sm max-w-none text-gray-700" v-html="note.content" />
            <p v-else class="text-sm text-gray-400 italic">Empty note</p>
          </template>
        </div>
      </div>

      <div v-else-if="!newNoteMode" class="py-12 text-center text-sm text-gray-400">
        <i class="pi pi-file-edit text-3xl mb-3 block text-gray-300" />
        No notes yet
      </div>
    </div><!-- /notes -->

  </div>
</template>
