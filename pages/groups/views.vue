<!--
  Views manager — create / edit / delete saved Classes-style views (group_views,
  migration 207). Each view picks which columns show + which top-level codes
  appear as tabs (none = all). Views render at /groups/view/:id and appear in
  the Groups nav flyout.
-->
<script setup lang="ts">
import type { GroupView, ViewColumnKey } from '~/composables/useGroupViews'
import type { GroupCode } from '~/composables/useGroupCodes'

const { orgId } = useOrg()
const toast = useToast()
const views = useGroupViews()
const gc = useGroupCodes()
const { ensureTerms, t } = useTerms()
void ensureTerms()

const list = ref<GroupView[]>([])
const allCodes = ref<GroupCode[]>([])
const loading = ref(true)

const editing = ref<GroupView | null>(null)
const dialogOpen = ref(false)
const form = reactive<{ name: string; columns: ViewColumnKey[]; codeIds: string[] }>({ name: '', columns: [], codeIds: [] })

async function load() {
  if (!orgId.value) return
  loading.value = true
  const [vs, codes] = await Promise.all([views.loadViews(), gc.loadCodes()])
  list.value = vs
  allCodes.value = codes
  loading.value = false
}

function openNew() {
  editing.value = null
  form.name = ''; form.columns = ['head', 'gymnasts', 'waitlist', 'attendances', 'termfee', 'gender', 'signup', 'sport']; form.codeIds = []
  dialogOpen.value = true
}
function openEdit(v: GroupView) {
  editing.value = v
  form.name = v.name; form.columns = [...v.config.columns]; form.codeIds = gc.closeSelection([...v.config.codeIds], allCodes.value)
  dialogOpen.value = true
}

async function save() {
  if (!form.name.trim()) { toast.add({ severity: 'warn', summary: 'Name is required', life: 2500 }); return }
  const config = { columns: form.columns, codeIds: form.codeIds }
  if (editing.value) await views.updateView(editing.value.id, { name: form.name.trim(), config })
  else await views.createView({ name: form.name.trim(), config, sort_order: list.value.length })
  dialogOpen.value = false
  await load()
  toast.add({ severity: 'success', summary: 'View saved', life: 1800 })
}

async function remove(v: GroupView) {
  await views.deleteView(v.id)
  await load()
  toast.add({ severity: 'success', summary: 'View deleted', life: 1800 })
}

const codeName = (id: string) => allCodes.value.find(c => c.id === id)?.name || '—'
const scopeLabel = (v: GroupView) => v.config.codeIds.length ? v.config.codeIds.map(codeName).join(', ') : `All ${t('code', true, true)}`
const colLabel = (v: GroupView) => views.VIEW_COLUMNS.filter(c => v.config.columns.includes(c.key)).map(c => c.label).join(' · ') || '—'

watch(orgId, () => { if (orgId.value) load() }, { immediate: true })
</script>

<template>
  <div class="p-3 sm:p-6 min-h-full">
    <div class="flex flex-col md:flex-row gap-4 md:gap-6">
      <GroupSettingsNav />
      <div class="flex-1 min-w-0 max-w-4xl space-y-5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h1 class="text-lg sm:text-2xl font-semibold text-gray-900">{{ t('group', true) }} views</h1>
        <p class="text-sm text-gray-500">Saved {{ t('group', true) }}-style pages — pick the columns and which {{ t('code', true, true) }} appear as tabs. Each shows in the {{ t('group', true) }} menu.</p>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <Button label="New view" icon="pi pi-plus" size="small" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="openNew" />
        <NuxtLink to="/groups" class="text-sm text-primary hover:underline whitespace-nowrap">← {{ t('group', true) }}</NuxtLink>
      </div>
    </div>

    <div class="card p-0 overflow-hidden">
      <div v-if="loading" class="p-5 text-sm text-gray-400">Loading…</div>
      <div v-else-if="!list.length" class="p-6 text-sm text-gray-500">
        No views yet — click <b>New view</b> to create one. A view is a saved {{ t('group', true) }} page with the columns and tabs you choose.
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs font-semibold text-gray-700">
            <th class="px-5 py-3">Name</th>
            <th class="px-3 py-3 hidden sm:table-cell">Tabs</th>
            <th class="px-3 py-3 hidden md:table-cell">Columns</th>
            <th class="px-5 py-3 text-right"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in list" :key="v.id" class="border-b border-gray-50 hover:bg-gray-50/60">
            <td class="px-5 py-2.5">
              <NuxtLink :to="`/groups/view/${v.id}`" class="font-medium text-primary hover:underline">{{ v.name }}</NuxtLink>
            </td>
            <td class="px-3 py-2.5 text-gray-500 hidden sm:table-cell">{{ scopeLabel(v) }}</td>
            <td class="px-3 py-2.5 text-gray-400 text-xs hidden md:table-cell">{{ colLabel(v) }}</td>
            <td class="px-5 py-2.5 text-right whitespace-nowrap">
              <button class="text-xs text-primary hover:underline mr-3" @click="openEdit(v)">Edit</button>
              <button class="text-xs text-red-600 hover:underline" @click="remove(v)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create / edit dialog -->
    <Dialog v-model:visible="dialogOpen" modal :header="editing ? 'Edit view' : 'New view'" :style="{ width: '95vw', maxWidth: '460px' }">
      <div class="space-y-4">
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Name</label>
          <InputText v-model="form.name" placeholder="e.g. Competitive squads" autofocus />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Columns</label>
          <div class="flex flex-wrap gap-3">
            <label v-for="c in views.VIEW_COLUMNS" :key="c.key" class="flex items-center gap-1.5 text-sm">
              <Checkbox v-model="form.columns" :value="c.key" />{{ c.label }}
            </label>
          </div>
          <span class="text-xs text-gray-400">Name is always shown.</span>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-medium text-gray-600">Tabs ({{ t('code', true, true) }})</label>
          <CodeTabsSelect v-model="form.codeIds" :codes="allCodes" />
          <span class="text-xs text-gray-400">Pick any {{ t('code', true, true) }} — choosing a parent selects &amp; locks its children. Empty = all top-level {{ t('code', true, true) }}.</span>
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="dialogOpen = false" />
        <Button :label="editing ? 'Save' : 'Create'" style="background:var(--brand-primary);border-color:var(--brand-primary)" @click="save" />
      </template>
    </Dialog>
  </div>
    </div>
  </div>
</template>
