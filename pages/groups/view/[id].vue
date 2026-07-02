<!--
  Saved group view — renders one configurable Classes-style view (group_views,
  migration 207) via <ClassesBoard>. Editing happens INLINE on this page: an
  "Edit" toggle reveals the name / columns / tabs controls; changing any of them
  updates the board in REAL TIME (the controls are bound straight to the board's
  reactive props) and autosaves (debounced) to group_views. Managed list at
  /groups/views; listed in the Groups nav flyout.
-->
<script setup lang="ts">
import type { GroupView, ViewColumnKey } from '~/composables/useGroupViews'
import type { GroupCode } from '~/composables/useGroupCodes'

const route = useRoute()
const toast = useToast()
const views = useGroupViews()
const gc = useGroupCodes()

const view = ref<GroupView | null>(null)
const loading = ref(true)
const editing = ref(false)

// Control bar owns the title (Classes › {view name}); no in-page <h1>.
useBreadcrumbs([{ label: 'Classes', to: '/groups' }, { label: () => view.value?.name || 'View' }])

// Live-editable config — bound directly to <ClassesBoard>, so toggling a column
// or tab re-renders the board immediately (no reload). Autosaved on change.
const name = ref('')
const columns = ref<ViewColumnKey[]>([])
const codeIds = ref<string[]>([])
const allCodes = ref<GroupCode[]>([])

// "Week View" of this view — the timetable scoped to the view's codes.
const weekViewLink = computed(() => {
  const ids = codeIds.value.filter(Boolean)
  return ids.length ? `/groups/timetable?codes=${ids.join(',')}` : '/groups/timetable'
})

const hydrating = ref(false)      // suppress autosave while we seed from the DB
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
let saveTimer: ReturnType<typeof setTimeout> | null = null
let savedFlagTimer: ReturnType<typeof setTimeout> | null = null

async function load() {
  loading.value = true
  hydrating.value = true
  const [v, codes] = await Promise.all([views.getView(route.params.id as string), gc.loadCodes()])
  view.value = v
  allCodes.value = codes
  if (v) { name.value = v.name; columns.value = [...v.config.columns]; codeIds.value = gc.closeSelection([...v.config.codeIds], codes) }
  loading.value = false
  await nextTick()
  hydrating.value = false
}

function scheduleSave() {
  if (hydrating.value || !view.value) return
  saveState.value = 'saving'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(persist, 500)
}
async function persist() {
  if (!view.value) return
  const trimmed = name.value.trim() || 'Untitled view'
  await views.updateView(view.value.id, { name: trimmed, config: { columns: columns.value, codeIds: codeIds.value } })
  view.value = { ...view.value, name: trimmed, config: { columns: [...columns.value], codeIds: [...codeIds.value] } }
  saveState.value = 'saved'
  if (savedFlagTimer) clearTimeout(savedFlagTimer)
  savedFlagTimer = setTimeout(() => { if (saveState.value === 'saved') saveState.value = 'idle' }, 1600)
}

// Any change to the live config autosaves (debounced) — this is the "real time" edit.
watch([name, columns, codeIds], scheduleSave, { deep: true })

async function removeView() {
  if (!view.value) return
  await views.deleteView(view.value.id)
  toast.add({ severity: 'success', summary: 'View deleted', life: 1800 })
  navigateTo('/groups/views')
}

watch(() => route.params.id, load, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4">
    <div v-if="loading" class="card p-6 text-sm text-gray-400">Loading…</div>
    <div v-else-if="!view" class="card p-6 text-sm text-gray-500">
      This view no longer exists. <NuxtLink to="/groups/views" class="text-primary hover:underline">Manage views</NuxtLink>.
    </div>
    <ClassesBoard v-else :columns="columns" :code-ids="codeIds">
      <template #toolbar>
        <span v-if="saveState === 'saving'" class="text-xs text-gray-400"><i class="pi pi-spin pi-spinner text-[10px]" /> Saving…</span>
        <span v-else-if="saveState === 'saved'" class="text-xs text-emerald-600"><i class="pi pi-check text-[10px]" /> Saved</span>
        <NuxtLink :to="weekViewLink" class="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300">
          <i class="pi pi-calendar text-xs" /> Week View
        </NuxtLink>
        <Button label="Edit" icon="pi pi-pencil" size="small" outlined @click="editing = true" />
      </template>
    </ClassesBoard>

    <!-- Edit dialog — changes autosave; the board updates live behind it. -->
    <Dialog v-model:visible="editing" modal header="Edit view" :style="{ width: '95vw', maxWidth: '520px' }">
      <div class="space-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Name</label>
          <InputText v-model="name" placeholder="View name" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Columns</label>
          <div class="flex flex-wrap gap-3">
            <label v-for="c in views.VIEW_COLUMNS" :key="c.key" class="flex items-center gap-1.5 text-sm">
              <Checkbox v-model="columns" :value="c.key" />{{ c.label }}
            </label>
          </div>
          <span class="text-xs text-gray-400">Name is always shown.</span>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Tabs (codes)</label>
          <CodeTabsSelect v-model="codeIds" :codes="allCodes" />
          <span class="text-xs text-gray-400">Pick any codes — choosing a parent selects &amp; locks its children. Empty = all top-level codes.</span>
        </div>
      </div>
      <template #footer>
        <button class="text-xs text-red-600 hover:underline mr-auto" @click="removeView">Delete this view</button>
        <Button label="Done" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="editing = false" />
      </template>
    </Dialog>
  </div>
</template>
