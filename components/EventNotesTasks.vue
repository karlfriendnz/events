<!--
  Reusable Notes & Tasks panel for an event. Self-contained by `event-id` — loads and
  writes its own event_notes / event_tasks via the useEventsApi seam. Drop it anywhere
  an event's notes + to-dos are wanted (the simple run-the-event view, and the full
  editor's Notes tab can adopt it too).
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
const props = defineProps<{ eventId: string }>()

const eventsApi = useEventsApi()
const toast = useToast()

const notes = ref<any[]>([])
const tasks = ref<any[]>([])
const newNote = ref('')
const newTask = ref('')

async function load() {
  notes.value = await eventsApi.notes(props.eventId).catch(() => [])
  tasks.value = await eventsApi.tasks(props.eventId).catch(() => [])
}
onMounted(load)
watch(() => props.eventId, load)
defineExpose({ reload: load })

async function addNote() {
  if (!newNote.value.trim()) return
  try {
    const n = await eventsApi.createNote(props.eventId, { content: newNote.value.trim() } as any)
    notes.value.unshift(n); newNote.value = ''
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Could not add note', detail: e?.message, life: 3500 }) }
}
async function delNote(n: any) {
  try { await eventsApi.removeNote(n.id); notes.value = notes.value.filter(x => x.id !== n.id) } catch { /* keep */ }
}
async function addTask() {
  if (!newTask.value.trim()) return
  try {
    const t = await eventsApi.createTask(props.eventId, { text: newTask.value.trim() } as any)
    tasks.value.push(t); newTask.value = ''
  } catch (e: any) { toast.add({ severity: 'error', summary: 'Could not add task', detail: e?.message, life: 3500 }) }
}
async function toggleTask(t: any) {
  const done = !t.done
  t.done = done
  try { await eventsApi.updateTask(t.id, { done }) } catch { t.done = !done }
}
async function delTask(t: any) {
  try { await eventsApi.removeTask(t.id); tasks.value = tasks.value.filter(x => x.id !== t.id) } catch { /* keep */ }
}
function noteDate(n: any) {
  return n.createdAt ? new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : ''
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- Notes -->
    <div class="card p-4 sm:p-5">
      <h2 class="text-sm font-semibold text-gray-800 mb-2">Notes</h2>
      <div class="flex gap-2 mb-3">
        <Textarea v-model="newNote" rows="1" autoResize placeholder="Add a note…" class="flex-1 text-sm"
          @keydown.enter.exact.prevent="addNote" />
        <Button icon="pi pi-plus" size="small" :disabled="!newNote.trim()"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="addNote" />
      </div>
      <div v-if="!notes.length" class="text-xs text-gray-400 py-4 text-center">No notes yet.</div>
      <ul v-else class="space-y-2">
        <li v-for="n in notes" :key="n.id" class="group flex items-start gap-2 text-sm">
          <i class="pi pi-comment text-gray-300 text-xs mt-1 shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-gray-800 whitespace-pre-wrap break-words">{{ n.content }}</p>
            <p class="text-[11px] text-gray-400">{{ noteDate(n) }}</p>
          </div>
          <button class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100" @click="delNote(n)"><i class="pi pi-times text-xs" /></button>
        </li>
      </ul>
    </div>

    <!-- Tasks -->
    <div class="card p-4 sm:p-5">
      <h2 class="text-sm font-semibold text-gray-800 mb-2">Tasks</h2>
      <div class="flex gap-2 mb-3">
        <InputText v-model="newTask" placeholder="Add a task…" class="flex-1 text-sm" @keydown.enter="addTask" />
        <Button icon="pi pi-plus" size="small" :disabled="!newTask.trim()"
          style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="addTask" />
      </div>
      <div v-if="!tasks.length" class="text-xs text-gray-400 py-4 text-center">No tasks yet.</div>
      <ul v-else class="space-y-1.5">
        <li v-for="t in tasks" :key="t.id" class="group flex items-center gap-2 text-sm">
          <Checkbox :model-value="t.done" binary @change="toggleTask(t)" />
          <span class="flex-1 min-w-0 truncate" :class="t.done ? 'text-gray-400 line-through' : 'text-gray-800'">{{ t.text }}</span>
          <button class="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100" @click="delTask(t)"><i class="pi pi-times text-xs" /></button>
        </li>
      </ul>
    </div>
  </div>
</template>
