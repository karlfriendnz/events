<!--
  Resources — a tagged, hierarchical file/link library (migration 246).
  Admin management: build folders, upload files / add links, and connect any
  folder or resource to person types / groups (audience cascades, per-item override).
-->
<script setup lang="ts">
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const { ensureTerms } = useTerms()
const {
  loadFolders, createFolder, renameFolder, moveFolder, deleteFolder,
  loadResources, createResource, updateResource, moveResource, deleteResource,
  loadAllTargets, effectiveTargets, kindFromFilename, kindIcon, kindLabel,
} = useResources()
const { uploadFile } = useUpload()

type Folder = Awaited<ReturnType<typeof loadFolders>>[number]
type Item = Awaited<ReturnType<typeof loadResources>>[number]

const folders = ref<Folder[]>([])
const items = ref<Item[]>([])
const targetsByOwner = ref<Record<string, any[]>>({})
const personTypesById = ref<Record<string, { label: string }>>({})
const groupsById = ref<Record<string, { name: string; color: string | null }>>({})
const currentFolderId = ref<string | null>(null)
const loading = ref(true)

const db = useDb()
const { orgId } = useOrg()

const foldersById = computed<Record<string, Folder>>(() =>
  Object.fromEntries(folders.value.map(f => [f.id, f])))

// Breadcrumb chain from the current folder up to root.
const path = computed<Folder[]>(() => {
  const chain: Folder[] = []
  let id = currentFolderId.value
  while (id) {
    const f = foldersById.value[id]
    if (!f) break
    chain.unshift(f)
    id = f.parent_id
  }
  return chain
})

// Keep the control-bar breadcrumb trail in sync with the folder path (dynamic
// depth, so we drive the shared state directly rather than via useBreadcrumbs).
const crumbState = useState<{ label: string; to?: string }[]>('breadcrumbs', () => [])
watchEffect(() => {
  crumbState.value = [{ label: 'Resources' }, ...path.value.map(f => ({ label: f.name }))]
})
onScopeDispose(() => { crumbState.value = [] })

const subFolders = computed(() => folders.value.filter(f => f.parent_id === currentFolderId.value))
const folderItems = computed(() => items.value.filter(i => i.folder_id === currentFolderId.value))
const isEmpty = computed(() => !subFolders.value.length && !folderItems.value.length)

function countIn(folderId: string) {
  const f = folders.value.filter(x => x.parent_id === folderId).length
  const r = items.value.filter(x => x.folder_id === folderId).length
  return f + r
}

async function load() {
  loading.value = true
  await ensureTerms()
  const [fs, rs, tg, types, grps] = await Promise.all([
    loadFolders(), loadResources(), loadAllTargets(),
    useOrgFieldPolicy().resolvePersonTypes(orgId.value),
    (db.from as any)('member_groups').select('id, name, color').eq('org_id', orgId.value),
  ])
  folders.value = fs
  items.value = rs
  targetsByOwner.value = tg
  personTypesById.value = Object.fromEntries((types ?? []).map((x: any) => [x.id, { label: x.label }]))
  groupsById.value = Object.fromEntries(((grps.data ?? []) as any[]).map(g => [g.id, { name: g.name, color: g.color }]))
  loading.value = false
}
onMounted(load)

// ---- Audience badges ----
function audienceFor(item: any, ownerType: 'folder' | 'resource') {
  const eff = effectiveTargets(item, ownerType, targetsByOwner.value, foldersById.value)
  const chips = eff.targets.map(t2 => {
    if (t2.target_type === 'group') {
      const g = groupsById.value[t2.target_id]
      return { label: g?.name ?? 'Group', color: g?.color ?? '#9CA3AF' }
    }
    return { label: personTypesById.value[t2.target_id]?.label ?? 'Type', color: null }
  })
  return { chips, inherited: eff.inherited, everyone: !chips.length }
}

// ---- New folder ----
const folderDlg = ref(false)
const folderName = ref('')
const renamingFolderId = ref<string | null>(null)
function openNewFolder() { renamingFolderId.value = null; folderName.value = ''; folderDlg.value = true }
function openRenameFolder(f: Folder) { renamingFolderId.value = f.id; folderName.value = f.name; folderDlg.value = true }
async function saveFolder() {
  const name = folderName.value.trim()
  if (!name) return
  if (renamingFolderId.value) {
    await renameFolder(renamingFolderId.value, name)
  } else {
    await createFolder(name, currentFolderId.value, subFolders.value.length)
  }
  folderDlg.value = false
  await load()
}

// ---- Add resource (link / video / upload) ----
const addMenu = ref()
const addModel = [
  { label: 'Website link', icon: 'pi pi-link', command: () => openLinkDlg('link') },
  { label: 'Video (link)', icon: 'pi pi-video', command: () => openLinkDlg('video') },
  { separator: true },
  { label: 'Upload PDF', icon: 'pi pi-file-pdf', command: () => pickFile('.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv', 'pdf') },
  { label: 'Upload image', icon: 'pi pi-image', command: () => pickFile('image/*', 'image') },
  { label: 'Upload video', icon: 'pi pi-video', command: () => pickFile('video/*', 'video') },
  { label: 'Upload file', icon: 'pi pi-file', command: () => pickFile('', 'file') },
]

// Link / video dialog
const linkDlg = ref(false)
const linkKind = ref<'link' | 'video'>('link')
const editingItemId = ref<string | null>(null)
const form = reactive({ title: '', url: '', description: '' })
function openLinkDlg(kind: 'link' | 'video') {
  editingItemId.value = null; linkKind.value = kind
  form.title = ''; form.url = ''; form.description = ''
  linkDlg.value = true
}
function openEditItem(it: Item) {
  editingItemId.value = it.id
  linkKind.value = it.kind === 'video' ? 'video' : 'link'
  form.title = it.title; form.url = it.url; form.description = it.description ?? ''
  linkDlg.value = true
}
async function saveLink() {
  if (!form.title.trim() || !form.url.trim()) return
  if (editingItemId.value) {
    await updateResource(editingItemId.value, { title: form.title.trim(), url: form.url.trim(), description: form.description.trim() || null })
  } else {
    await createResource({ kind: linkKind.value, title: form.title.trim(), url: form.url.trim(), description: form.description.trim() || null, folderId: currentFolderId.value, sortOrder: folderItems.value.length })
  }
  linkDlg.value = false
  await load()
}

// File upload
const fileInput = ref<HTMLInputElement | null>(null)
const pendingKind = ref<'pdf' | 'image' | 'video' | 'file'>('file')
const uploading = ref(false)
function pickFile(accept: string, kind: 'pdf' | 'image' | 'video' | 'file') {
  pendingKind.value = kind
  if (fileInput.value) { fileInput.value.value = ''; fileInput.value.accept = accept; fileInput.value.click() }
}
async function onFileChosen(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const url = await uploadFile(file)
    const kind = pendingKind.value === 'file' ? kindFromFilename(file.name) : pendingKind.value
    await createResource({ kind, title: file.name.replace(/\.[^.]+$/, ''), url, folderId: currentFolderId.value, sortOrder: folderItems.value.length })
    await load()
    toast.add({ severity: 'success', summary: 'Uploaded', life: 2000 })
  } catch (err: any) {
    toast.add({ severity: 'error', summary: 'Upload failed', detail: err?.data?.message || err?.message, life: 5000 })
  } finally {
    uploading.value = false
  }
}

// ---- Connect audience ----
const connectDlg = ref(false)
const connectOwner = reactive<{ type: 'folder' | 'resource'; id: string | null; name: string; canInherit: boolean; override: boolean; inheritedSummary: string }>(
  { type: 'resource', id: null, name: '', canInherit: false, override: false, inheritedSummary: '' })
function openConnect(item: any, ownerType: 'folder' | 'resource') {
  const parentId = ownerType === 'folder' ? item.parent_id : item.folder_id
  const aud = audienceFor(item, ownerType)
  connectOwner.type = ownerType
  connectOwner.id = item.id
  connectOwner.name = ownerType === 'folder' ? item.name : item.title
  connectOwner.canInherit = !!parentId
  connectOwner.override = !!item.override_targets
  connectOwner.inheritedSummary = aud.everyone ? 'Everyone' : aud.chips.map((c: any) => c.label).join(', ')
  connectDlg.value = true
}

// ---- Move ----
const moveDlg = ref(false)
const moveOwner = reactive<{ type: 'folder' | 'resource'; id: string | null; name: string }>({ type: 'resource', id: null, name: '' })
const moveTarget = ref<string | null>(null)
const folderOptions = computed(() => {
  // Indented folder list; a folder can't move into itself or a descendant.
  const opts: { label: string; value: string | null }[] = [{ label: '— Root —', value: null }]
  const walk = (parentId: string | null, depth: number) => {
    for (const f of folders.value.filter(x => x.parent_id === parentId)) {
      if (moveOwner.type === 'folder' && (f.id === moveOwner.id || isDescendant(f.id, moveOwner.id))) continue
      opts.push({ label: `${'  '.repeat(depth)}${f.name}`, value: f.id })
      walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return opts
})
function isDescendant(candidate: string | null, ancestorId: string | null): boolean {
  let id = candidate
  while (id) {
    const f = foldersById.value[id]
    if (!f) return false
    if (f.parent_id === ancestorId) return true
    id = f.parent_id
  }
  return false
}
function openMove(item: any, ownerType: 'folder' | 'resource') {
  moveOwner.type = ownerType; moveOwner.id = item.id
  moveOwner.name = ownerType === 'folder' ? item.name : item.title
  moveTarget.value = ownerType === 'folder' ? item.parent_id : item.folder_id
  moveDlg.value = true
}
async function doMove() {
  if (!moveOwner.id) return
  await performMove(moveOwner.type, moveOwner.id, moveTarget.value)
  moveDlg.value = false
}
async function performMove(type: 'folder' | 'resource', id: string, target: string | null) {
  if (type === 'folder') {
    if (id === target || isDescendant(target, id)) return  // no cycles
    await moveFolder(id, target)
  } else {
    await moveResource(id, target)
  }
  await load()
}

// ---- Delete ----
async function removeFolder(f: Folder) {
  if (!confirm(`Delete folder "${f.name}" and everything inside it?`)) return
  await deleteFolder(f.id)
  await load()
}
async function removeItem(it: Item) {
  if (!confirm(`Delete "${it.title}"?`)) return
  await deleteResource(it.id)
  await load()
}

// ---- Drag to move (native HTML5) ----
const dragging = ref<{ type: 'folder' | 'resource'; id: string } | null>(null)
function onDragStart(type: 'folder' | 'resource', id: string) { dragging.value = { type, id } }
function onDropFolder(folderId: string) {
  if (!dragging.value) return
  const d = dragging.value; dragging.value = null
  if (d.type === 'folder' && d.id === folderId) return
  performMove(d.type, d.id, folderId)
}
function onDropCrumb(folderId: string | null) {
  if (!dragging.value) return
  const d = dragging.value; dragging.value = null
  performMove(d.type, d.id, folderId)
}

// Row/tile action menus
const rowMenu = ref()
const rowMenuModel = ref<any[]>([])
function openRowMenu(e: Event, item: any, ownerType: 'folder' | 'resource') {
  rowMenuModel.value = ownerType === 'folder'
    ? [
        { label: 'Open', icon: 'pi pi-folder-open', command: () => (currentFolderId.value = item.id) },
        { label: 'Connect audience', icon: 'pi pi-users', command: () => openConnect(item, 'folder') },
        { label: 'Rename', icon: 'pi pi-pencil', command: () => openRenameFolder(item) },
        { label: 'Move', icon: 'pi pi-arrows-alt', command: () => openMove(item, 'folder') },
        { separator: true },
        { label: 'Delete', icon: 'pi pi-trash', class: 'text-red-500', command: () => removeFolder(item) },
      ]
    : [
        { label: 'Open', icon: 'pi pi-external-link', command: () => window.open(item.url, '_blank') },
        { label: 'Connect audience', icon: 'pi pi-users', command: () => openConnect(item, 'resource') },
        { label: 'Edit', icon: 'pi pi-pencil', command: () => openEditItem(item), visible: item.kind === 'link' || item.kind === 'video' },
        { label: 'Move', icon: 'pi pi-arrows-alt', command: () => openMove(item, 'resource') },
        { separator: true },
        { label: 'Delete', icon: 'pi pi-trash', class: 'text-red-500', command: () => removeItem(item) },
      ]
  rowMenu.value.toggle(e)
}
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />

    <!-- Toolbar: folder breadcrumbs + actions -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <!-- In-page folder path (drop targets for drag-move) -->
      <nav class="flex items-center gap-1 text-sm min-w-0 overflow-x-auto no-scrollbar">
        <button class="shrink-0 px-2 py-1 rounded-md hover:bg-gray-100 text-gray-600"
          :class="currentFolderId === null ? 'font-semibold text-gray-800' : ''"
          @click="currentFolderId = null" @dragover.prevent @drop="onDropCrumb(null)">
          <i class="pi pi-home text-xs mr-1" />Resources
        </button>
        <template v-for="f in path" :key="f.id">
          <i class="pi pi-angle-right text-gray-300 text-xs shrink-0" />
          <button class="shrink-0 px-2 py-1 rounded-md hover:bg-gray-100 truncate max-w-[40vw]"
            :class="f.id === currentFolderId ? 'font-semibold text-gray-800' : 'text-gray-600'"
            @click="currentFolderId = f.id" @dragover.prevent @drop="onDropCrumb(f.id)">
            {{ f.name }}
          </button>
        </template>
      </nav>
      <div class="sm:ml-auto flex items-center gap-2">
        <Button label="New folder" icon="pi pi-folder" size="small" outlined class="w-full sm:w-auto justify-center" @click="openNewFolder" />
        <Button label="Add resource" icon="pi pi-plus" size="small" :loading="uploading"
          style="background:#1E2157;border-color:#1E2157" class="w-full sm:w-auto justify-center"
          @click="(e:any) => addMenu.toggle(e)" />
        <Menu ref="addMenu" :model="addModel" popup />
      </div>
    </div>

    <div v-if="loading" class="text-sm text-gray-400 py-10 text-center">Loading…</div>

    <div v-else-if="isEmpty" class="card p-10 text-center">
      <i class="pi pi-folder-open text-3xl text-gray-300 block mb-2" />
      <p class="text-sm text-gray-500">This folder is empty.</p>
      <p class="text-xs text-gray-400 mt-1">Create a sub-folder or add a resource to get started.</p>
    </div>

    <template v-else>
      <!-- Folders -->
      <div v-if="subFolders.length" class="space-y-2">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Folders</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div v-for="f in subFolders" :key="f.id" draggable="true"
            class="card p-3 flex items-start gap-3 cursor-pointer hover:border-primary/40 transition-colors"
            @dragstart="onDragStart('folder', f.id)" @dragover.prevent @drop="onDropFolder(f.id)"
            @click="currentFolderId = f.id">
            <div class="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
              <i class="pi pi-folder text-amber-500" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-gray-800 truncate">{{ f.name }}</p>
              <p class="text-xs text-gray-400">{{ countIn(f.id) }} item{{ countIn(f.id) === 1 ? '' : 's' }}</p>
              <div class="mt-1.5"><AudienceBadges :audience="audienceFor(f, 'folder')" /></div>
            </div>
            <button class="text-gray-300 hover:text-gray-600 shrink-0 -mt-1" @click.stop="openRowMenu($event, f, 'folder')">
              <i class="pi pi-ellipsis-v" />
            </button>
          </div>
        </div>
      </div>

      <!-- Resources -->
      <div v-if="folderItems.length" class="space-y-2">
        <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Resources</p>
        <div class="card divide-y divide-gray-100">
          <div v-for="it in folderItems" :key="it.id" draggable="true"
            class="flex items-center gap-3 px-3 sm:px-4 py-2.5"
            @dragstart="onDragStart('resource', it.id)">
            <div class="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
              <i class="pi" :class="kindIcon(it.kind)" style="color:#6B7280" />
            </div>
            <div class="min-w-0 flex-1">
              <a :href="it.url" target="_blank" class="text-sm font-medium text-gray-800 hover:text-primary truncate block">{{ it.title }}</a>
              <div class="flex items-center gap-2 flex-wrap mt-0.5">
                <span class="text-xs text-gray-400">{{ kindLabel(it.kind) }}</span>
                <AudienceBadges :audience="audienceFor(it, 'resource')" />
              </div>
            </div>
            <a :href="it.url" target="_blank" class="text-gray-300 hover:text-primary shrink-0" v-tooltip.top="'Open'"><i class="pi pi-external-link" /></a>
            <button class="text-gray-300 hover:text-gray-600 shrink-0" @click="openRowMenu($event, it, 'resource')"><i class="pi pi-ellipsis-v" /></button>
          </div>
        </div>
      </div>
    </template>

    <Menu ref="rowMenu" :model="rowMenuModel" popup />

    <!-- New/rename folder dialog -->
    <Dialog v-model:visible="folderDlg" modal :style="{ width: '95vw', maxWidth: '420px' }"
      :header="renamingFolderId ? 'Rename folder' : 'New folder'">
      <InputText v-model="folderName" placeholder="Folder name" class="w-full" @keyup.enter="saveFolder" autofocus />
      <template #footer>
        <Button label="Cancel" text @click="folderDlg = false" />
        <Button :label="renamingFolderId ? 'Save' : 'Create'" style="background:#1E2157;border-color:#1E2157" @click="saveFolder" />
      </template>
    </Dialog>

    <!-- Link / video dialog -->
    <Dialog v-model:visible="linkDlg" modal :style="{ width: '95vw', maxWidth: '480px' }"
      :header="editingItemId ? 'Edit resource' : (linkKind === 'video' ? 'Add video link' : 'Add website link')">
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">Title</label>
          <InputText v-model="form.title" class="w-full" placeholder="e.g. Coaching drills video" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">{{ linkKind === 'video' ? 'Video URL (YouTube, Vimeo…)' : 'Website URL' }}</label>
          <InputText v-model="form.url" class="w-full" placeholder="https://…" />
        </div>
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">Description <span class="text-gray-300">(optional)</span></label>
          <Textarea v-model="form.description" class="w-full" rows="2" autoResize />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="linkDlg = false" />
        <Button :label="editingItemId ? 'Save' : 'Add'" style="background:#1E2157;border-color:#1E2157" @click="saveLink" />
      </template>
    </Dialog>

    <!-- Move dialog -->
    <Dialog v-model:visible="moveDlg" modal :style="{ width: '95vw', maxWidth: '420px' }" :header="`Move ${moveOwner.name}`">
      <label class="text-xs font-medium text-gray-500 block mb-1">Destination folder</label>
      <Select v-model="moveTarget" :options="folderOptions" optionLabel="label" optionValue="value" class="w-full" />
      <template #footer>
        <Button label="Cancel" text @click="moveDlg = false" />
        <Button label="Move" style="background:#1E2157;border-color:#1E2157" @click="doMove" />
      </template>
    </Dialog>

    <!-- Connect audience dialog -->
    <ResourceConnectDialog v-model:visible="connectDlg"
      :owner-type="connectOwner.type" :owner-id="connectOwner.id" :name="connectOwner.name"
      :can-inherit="connectOwner.canInherit" :override="connectOwner.override"
      :inherited-summary="connectOwner.inheritedSummary" @saved="load" />
  </div>
</template>
