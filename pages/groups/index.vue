<!--
  Groups landing = the Classes view. The tabbed <ClassesBoard> (top-level codes
  as tabs, class tables inside) IS this page — the old codes/groups tree was
  redundant with it + /groups/codes. Group + code creation (the one thing only
  this landing had) is kept as header dialogs; everything else (organise codes,
  allocate, fees, rollover, saved views) is a header link / the nav flyout.
-->
<template>
  <div class="p-3 sm:p-6 space-y-4">
    <ClassesBoard ref="board" allow-new-tab>
      <template #toolbar>
        <NuxtLink to="/groups/timetable" class="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300">
          <i class="pi pi-calendar text-xs" /> Week View
        </NuxtLink>
        <Button label="Find a class" icon="pi pi-search" size="small" outlined severity="secondary"
          class="text-gray-700" @click="finder.openFinder()" />
        <Button label="New code" icon="pi pi-sitemap" size="small" outlined severity="secondary"
          class="text-gray-700" @click="openCreateCode()" />
        <Button label="New group" icon="pi pi-plus" size="small"
          style="background:#1E2157;border-color:#1E2157" @click="openCreateGroup()" />
      </template>
    </ClassesBoard>

    <!-- New group dialog -->
    <Dialog v-model:visible="createGroupOpen" modal :style="{ width: '95vw', maxWidth: '420px' }" header="New group">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="newGroup.name" autofocus placeholder="e.g. Under 16s" @keyup.enter="handleCreateGroup" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Code</label>
          <Select v-model="newGroup.code_id" :options="codeOptions" optionLabel="label" optionValue="value"
            placeholder="Ungrouped" class="w-full" showClear />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Colour</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in PALETTE" :key="c" type="button"
              class="w-7 h-7 rounded-full border-2 transition-transform"
              :class="newGroup.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"
              :style="{ background: c }" @click="newGroup.color = c" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="createGroupOpen = false" />
        <Button label="Create" :loading="creating" :disabled="!newGroup.name.trim()"
          style="background:#1E2157;border-color:#1E2157" @click="handleCreateGroup" />
      </template>
    </Dialog>

    <!-- New code dialog -->
    <Dialog v-model:visible="createCodeOpen" modal :style="{ width: '95vw', maxWidth: '420px' }" header="New code">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Name</label>
          <InputText v-model="newCode.name" autofocus placeholder="e.g. Development" @keyup.enter="handleCreateCode" />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Parent code</label>
          <Select v-model="newCode.parent_id" :options="codeOptions" optionLabel="label" optionValue="value"
            placeholder="Top level" class="w-full" showClear />
        </div>
        <div v-if="terms.length" class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Term</label>
          <Select v-model="newCode.term_id" :options="termSelectOptions" optionLabel="label" optionValue="value"
            placeholder="No term" class="w-full" showClear />
          <p class="text-xs text-gray-400">Groups inside this code inherit its term.</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Colour</label>
          <div class="flex flex-wrap gap-2">
            <button v-for="c in PALETTE" :key="c" type="button"
              class="w-7 h-7 rounded border-2 transition-transform"
              :class="newCode.color === c ? 'border-gray-800 scale-110' : 'border-transparent'"
              :style="{ background: c }" @click="newCode.color = c" />
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="createCodeOpen = false" />
        <Button label="Create" :loading="creatingCode" :disabled="!newCode.name.trim()"
          style="background:#1E2157;border-color:#1E2157" @click="handleCreateCode" />
      </template>
    </Dialog>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import type { GroupCode } from '~/composables/useGroupCodes'

const db = useDb()
const { orgId } = useOrg()
const toast = useToast()
const gc = useGroupCodes()
const finder = useClassFinder()
// Control bar owns the page title (see the "control bar owns the title" rule).
useBreadcrumbs([{ label: 'Classes' }])
const tm = useTermsMemberships()

const PALETTE = ['#1E2157', '#2563EB', '#0f766e', '#059669', '#9333ea', '#EC4899', '#c2410c', '#be123c', '#8B5CF6', '#64748b']

const board = ref<{ reload: () => Promise<void> } | null>(null)
const codes = ref<GroupCode[]>([])
const terms = ref<{ id: string; name: string }[]>([])

// Codes in tree order with a depth, for indented Select labels.
const codeOptions = computed(() => {
  const byParent: Record<string, GroupCode[]> = {}
  const sorted = [...codes.value].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name))
  for (const c of sorted) (byParent[c.parent_id ?? '__root'] ??= []).push(c)
  const out: { label: string; value: string }[] = []
  const walk = (key: string, depth: number) => {
    for (const c of (byParent[key] ?? [])) { out.push({ label: `${'  '.repeat(depth)}${c.name}`, value: c.id }); walk(c.id, depth + 1) }
  }
  walk('__root', 0)
  return out
})
const termSelectOptions = computed(() => terms.value.map(t => ({ label: t.name, value: t.id })))
const codesById = computed<Record<string, GroupCode>>(() => Object.fromEntries(codes.value.map(c => [c.id, c])))

// ── Create dialogs ──
const createGroupOpen = ref(false)
const creating = ref(false)
const newGroup = reactive<{ name: string; color: string; code_id: string | null }>({ name: '', color: PALETTE[0], code_id: null })

const createCodeOpen = ref(false)
const creatingCode = ref(false)
const newCode = reactive<{ name: string; color: string; parent_id: string | null; term_id: string | null }>({ name: '', color: PALETTE[0], parent_id: null, term_id: null })

function openCreateGroup(codeId: string | null = null) {
  newGroup.name = ''; newGroup.color = PALETTE[0]; newGroup.code_id = codeId
  createGroupOpen.value = true
}
function openCreateCode(parentId: string | null = null) {
  newCode.name = ''; newCode.color = PALETTE[0]; newCode.parent_id = parentId
  newCode.term_id = parentId ? (codesById.value[parentId]?.term_id ?? null) : null
  createCodeOpen.value = true
}

async function handleCreateGroup() {
  if (!newGroup.name.trim()) return
  creating.value = true
  const siblings = codes.value.length // rough; sort_order just needs to be monotone-ish
  const { error } = await (db.from as any)('member_groups').insert({
    org_id: orgId.value, name: newGroup.name.trim(), color: newGroup.color,
    code_id: newGroup.code_id, parent_id: null, sort_order: siblings,
  })
  if (!error) {
    toast.add({ severity: 'success', summary: 'Group created', life: 2500 })
    createGroupOpen.value = false
    await refresh()
  } else {
    toast.add({ severity: 'error', summary: 'Could not create group', detail: error.message, life: 4000 })
  }
  creating.value = false
}

async function handleCreateCode() {
  if (!newCode.name.trim()) return
  creatingCode.value = true
  const siblings = codes.value.filter(c => (c.parent_id ?? null) === (newCode.parent_id ?? null))
  const nextOrder = siblings.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0) + 1
  const created = await gc.createCode({
    name: newCode.name.trim(), color: newCode.color, parent_id: newCode.parent_id, term_id: newCode.term_id, sort_order: nextOrder,
  })
  if (created) {
    toast.add({ severity: 'success', summary: 'Code created', life: 2500 })
    createCodeOpen.value = false
    await refresh()
  } else {
    toast.add({ severity: 'error', summary: 'Could not create code', life: 4000 })
  }
  creatingCode.value = false
}

// Reload the dialogs' code/term options + the classes board.
async function loadOptions() {
  if (!orgId.value) return
  const [codeList, termList] = await Promise.all([gc.loadCodes(), tm.loadTerms()])
  codes.value = codeList
  terms.value = termList ?? []
}
async function refresh() {
  await loadOptions()
  await board.value?.reload()
}

watch(orgId, loadOptions, { immediate: true })
</script>
