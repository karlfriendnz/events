<!--
  Super-admin help-article authoring. Platform-wide (org_id-less) — articles are
  written ONCE with terminology tokens ({member}/{groups}/{term}…) and every club
  sees them in its own words. Master-detail: list of all articles + an editor
  (key/title/route, module + resource gating, explanation, ordered steps, status).
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { HelpArticle } from '~/composables/useHelp'
definePageMeta({ layout: 'admin' })

const user = useSupabaseUser()
const toast = useToast()
const isSuper = computed(() => ((user.value as any)?.app_metadata?.role) === 'super_admin')

const { loadHelpArticles, saveHelpArticle, deleteHelpArticle } = useHelp()

const moduleOptions = computed(() => [
  { value: null, label: 'Always (no module)' },
  ...MODULE_DEFS.map(m => ({ value: m.key, label: m.label })),
])
const resourceOptions = computed(() => [
  { value: null, label: 'Everyone (no role gate)' },
  ...PERMISSION_RESOURCES.map(r => ({ value: r.key, label: `${r.label} · ${r.area}` })),
])

const articles = ref<HelpArticle[]>([])
const loading = ref(true)
const selectedId = ref<string | null>(null)
const editing = ref<HelpArticle | null>(null)
const saving = ref(false)

async function load() {
  loading.value = true
  articles.value = await loadHelpArticles({ all: true })
  loading.value = false
}

function blankArticle(): HelpArticle {
  return {
    id: '', key: '', title: '', explanation: '', steps: [],
    module: null, resource: null, route: null, sort_order: articles.value.length * 10, status: 'draft',
  }
}

function selectArticle(a: HelpArticle) {
  selectedId.value = a.id
  // Deep clone so edits don't mutate the list until saved.
  editing.value = { ...a, steps: a.steps.map(s => ({ ...s })) }
}
function startNew() {
  selectedId.value = null
  editing.value = blankArticle()
}
function pickById(id: string) {
  const a = articles.value.find(x => x.id === id)
  if (a) selectArticle(a)
}

function addStep() {
  editing.value?.steps.push({ title: '', body: '' })
}
function removeStep(i: number) {
  editing.value?.steps.splice(i, 1)
}
function setPublished(v: boolean) {
  if (editing.value) editing.value.status = v ? 'published' : 'draft'
}
function moveStep(i: number, dir: -1 | 1) {
  const steps = editing.value?.steps
  if (!steps) return
  const j = i + dir
  if (j < 0 || j >= steps.length) return
  const tmp = steps[i]; steps[i] = steps[j]; steps[j] = tmp
}

const canSave = computed(() => !!editing.value?.key.trim() && !!editing.value?.title.trim())

async function save() {
  if (!editing.value || !canSave.value) return
  saving.value = true
  const saved = await saveHelpArticle(editing.value)
  saving.value = false
  if (!saved) { toast.add({ severity: 'error', summary: 'Could not save', detail: 'Check the key is unique.', life: 4000 }); return }
  toast.add({ severity: 'success', summary: 'Saved', life: 1500 })
  await load()
  selectArticle(articles.value.find(a => a.id === saved.id) || saved)
}

async function removeArticle() {
  if (!editing.value?.id) return
  if (!confirm('Delete this help article?')) return
  await deleteHelpArticle(editing.value.id)
  toast.add({ severity: 'success', summary: 'Deleted', life: 1500 })
  editing.value = null; selectedId.value = null
  await load()
}

onMounted(() => {
  if (!isSuper.value) { navigateTo('/'); return }
  load()
})
</script>

<template>
  <div v-if="isSuper" class="p-3 sm:p-6 md:p-8 space-y-4">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Help docs</h1>
        <p class="text-sm text-gray-500">Platform-wide help articles. Written once with terminology tokens — every club sees its own words.</p>
      </div>
      <Button label="New article" icon="pi pi-plus" size="small" class="w-full sm:w-auto"
        style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="startNew" />
    </div>

    <!-- Mobile article chooser -->
    <div class="lg:hidden">
      <Select :modelValue="selectedId" :options="articles" option-label="title" option-value="id" placeholder="Choose an article…"
        class="w-full" @update:modelValue="pickById" />
    </div>

    <div class="flex flex-col lg:flex-row gap-4">
      <!-- List -->
      <div class="hidden lg:block w-72 shrink-0">
        <div class="card p-0 overflow-hidden">
          <div v-if="loading" class="p-4 text-sm text-gray-400">Loading…</div>
          <div v-else-if="!articles.length" class="p-4 text-sm text-gray-400">No articles yet.</div>
          <button v-for="a in articles" :key="a.id" type="button"
            class="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
            :class="selectedId === a.id ? 'bg-primary/5' : ''" @click="selectArticle(a)">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-medium text-gray-800 truncate">{{ a.title || a.key }}</span>
              <span class="text-[11px] shrink-0 px-1.5 py-0.5 rounded"
                :class="a.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                {{ a.status === 'published' ? 'Published' : 'Draft' }}
              </span>
            </div>
            <div class="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-gray-400">
              <span class="font-mono">{{ a.key }}</span>
              <span v-if="a.module" class="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">{{ a.module }}</span>
              <span v-if="a.resource" class="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600">{{ a.resource }}</span>
            </div>
          </button>
        </div>
      </div>

      <!-- Editor -->
      <div class="flex-1 min-w-0">
        <div v-if="!editing" class="card p-8 text-center text-sm text-gray-400">
          Select an article or create a new one.
        </div>
        <div v-else class="card p-4 sm:p-5 space-y-4">
          <p class="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Write <span class="font-mono">{member}</span>, <span class="font-mono">{groups}</span>, <span class="font-mono">{term}</span>… — each club sees its own words. Capitalise the token (<span class="font-mono">{Member}</span>) to capitalise the label.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Key (stable slug)</label>
              <InputText v-model="editing.key" placeholder="e.g. term-setup-wizard" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Route (optional)</label>
              <InputText v-model="editing.route" placeholder="e.g. /groups/term-wizard" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Title</label>
            <InputText v-model="editing.title" placeholder="Setting up your next {term}" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Module</label>
              <Select v-model="editing.module" :options="moduleOptions" option-label="label" option-value="value" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Role access (resource)</label>
              <Select v-model="editing.resource" :options="resourceOptions" option-label="label" option-value="value" class="w-full" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Sort order</label>
              <InputNumber v-model="editing.sort_order" :min="0" class="w-full" />
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Explanation</label>
            <Textarea v-model="editing.explanation" rows="4" auto-resize placeholder="What is this and why does it matter?" />
          </div>

          <!-- Steps -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold uppercase tracking-wide text-gray-400">Step-by-step tutorial</label>
              <button type="button" class="text-xs font-medium text-primary hover:underline" @click="addStep">+ Add step</button>
            </div>
            <div v-if="!editing.steps.length" class="text-sm text-gray-400">No steps yet.</div>
            <div v-for="(s, i) in editing.steps" :key="i" class="border border-gray-200 rounded-lg p-3 space-y-2">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{{ i + 1 }}</span>
                <InputText v-model="s.title" class="flex-1" placeholder="Step title" />
                <button type="button" class="text-gray-300 hover:text-gray-600 w-7 h-7 flex items-center justify-center" :disabled="i === 0" @click="moveStep(i, -1)"><i class="pi pi-arrow-up text-xs" /></button>
                <button type="button" class="text-gray-300 hover:text-gray-600 w-7 h-7 flex items-center justify-center" :disabled="i === editing.steps.length - 1" @click="moveStep(i, 1)"><i class="pi pi-arrow-down text-xs" /></button>
                <button type="button" class="text-gray-300 hover:text-red-500 w-7 h-7 flex items-center justify-center" @click="removeStep(i)"><i class="pi pi-trash text-xs" /></button>
              </div>
              <Textarea v-model="s.body" rows="2" auto-resize class="w-full" placeholder="Step body" />
            </div>
          </div>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 pt-4">
            <div class="flex items-center gap-2">
              <ToggleSwitch :modelValue="editing.status === 'published'" @update:modelValue="setPublished" />
              <span class="text-sm text-gray-600">{{ editing.status === 'published' ? 'Published' : 'Draft' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <Button v-if="editing.id" label="Delete" severity="danger" text size="small" @click="removeArticle" />
              <Button label="Save" :loading="saving" :disabled="!canSave" size="small"
                style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <Toast />
  </div>
</template>
