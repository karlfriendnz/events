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
  loadFolders, createFolder, renameFolder, moveFolder, deleteFolder, reorderFolders,
  loadResources, createResource, updateResource, moveResource, deleteResource, reorderResources,
  loadAllTargets, effectiveTargets, kindFromFilename, kindIcon, kindLabel,
  loadViewStats, loadAudienceIndex, audiencePersonIds,
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

/** Everything inside a folder, all the way down — what a delete would actually take. */
function deepCountIn(folderId: string): number {
  const kids = folders.value.filter(x => x.parent_id === folderId)
  return kids.length
    + items.value.filter(x => x.folder_id === folderId).length
    + kids.reduce((n, k) => n + deepCountIn(k.id), 0)
}

// ---- Search (the whole library, not just this folder) ----
const search = ref('')
const searching = computed(() => search.value.trim().length > 0)

/** "Coaching / Drills" — where a thing lives, for search results. */
function locationOf(parentId: string | null): string {
  const chain: string[] = []
  let id = parentId
  while (id) {
    const f = foldersById.value[id]
    if (!f) break
    chain.unshift(f.name)
    id = f.parent_id
  }
  return chain.length ? chain.join(' / ') : 'Resources'
}

const results = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return { folders: [] as Folder[], items: [] as Item[] }
  return {
    folders: folders.value.filter(f => f.name.toLowerCase().includes(q)),
    items: items.value.filter(i =>
      i.title.toLowerCase().includes(q)
      || (i.description ?? '').toLowerCase().includes(q)
      || i.url.toLowerCase().includes(q)),
  }
})
const noResults = computed(() => searching.value && !results.value.folders.length && !results.value.items.length)

/** Jump out of search to wherever a result lives. */
function goToFolder(id: string | null) {
  search.value = ''
  currentFolderId.value = id
}

// ---- Left-hand folder tree ----
// Flattened into depth-tagged rows rather than a recursive component: one v-for,
// and the drop/expand handlers stay in one place.
const expanded = ref<Record<string, boolean>>({})
const childrenOf = computed<Record<string, Folder[]>>(() => {
  const map: Record<string, Folder[]> = {}
  for (const f of folders.value) (map[f.parent_id ?? '__root'] ??= []).push(f)
  return map
})
const hasChildren = (id: string) => !!childrenOf.value[id]?.length

const treeRows = computed<{ folder: Folder; depth: number }[]>(() => {
  const rows: { folder: Folder; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const f of childrenOf.value[parentId ?? '__root'] ?? []) {
      rows.push({ folder: f, depth })
      if (expanded.value[f.id]) walk(f.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
})

function toggleExpand(id: string) { expanded.value[id] = !expanded.value[id] }

// Always keep the path to the open folder unfolded, so the tree shows where you are.
watch([currentFolderId, foldersById], () => {
  let id = currentFolderId.value ? foldersById.value[currentFolderId.value]?.parent_id : null
  while (id) {
    expanded.value[id] = true
    id = foldersById.value[id]?.parent_id ?? null
  }
}, { immediate: true })

/** Dropping onto a tree row moves the thing into that folder (root = out of every folder). */
function onDropTree(folderId: string | null) {
  const d = dragging.value
  onDragEnd()
  if (!d) return
  if (d.type === 'folder' && d.id === folderId) return
  if (folderId) expanded.value[folderId] = true
  performMove(d.type, d.id, folderId)
}

async function load() {
  loading.value = true
  await ensureTerms()
  const [fs, rs, tg, types, grps, vs, aud, ppl] = await Promise.all([
    loadFolders(), loadResources(), loadAllTargets(),
    useOrgFieldPolicy().resolvePersonTypes(orgId.value),
    (db.from as any)('member_groups').select('id, name, color').eq('org_id', orgId.value),
    loadViewStats(), loadAudienceIndex(),
    (db.from as any)('persons').select('id, first_name, last_name').eq('org_id', orgId.value),
  ])
  folders.value = fs
  items.value = rs
  targetsByOwner.value = tg
  personTypesById.value = Object.fromEntries((types ?? []).map((x: any) => [x.id, { label: x.label }]))
  groupsById.value = Object.fromEntries(((grps.data ?? []) as any[]).map(g => [g.id, { name: g.name, color: g.color }]))
  stats.value = vs
  audience.value = aud
  peopleById.value = Object.fromEntries(((ppl.data ?? []) as any[])
    .map(p => [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unnamed']))
  loading.value = false
}
onMounted(load)

// ---- Engagement (migration 260) ----
// The rate is only honest against the people the resource was actually aimed at, so
// viewers are intersected with the audience: an admin previewing from this screen adds
// to total opens but can never inflate the reach %.
const stats = ref<Record<string, any>>({})
const audience = ref<any>({ byType: {}, byGroup: {}, everyone: [] })

function engagementFor(it: Item) {
  const { targets } = effectiveTargets(it, 'resource', targetsByOwner.value, foldersById.value)
  const audienceIds = audiencePersonIds(targets, audience.value)
  const s = stats.value[it.id]
  const audienceSet = new Set(audienceIds)
  const reached = (s?.viewerIds ?? []).filter((id: string) => audienceSet.has(id))
  return {
    audienceIds,
    audienceCount: audienceIds.length,
    reached,
    reachedCount: reached.length,
    rate: audienceIds.length ? Math.round((reached.length / audienceIds.length) * 100) : null,
    opens: s?.opens ?? 0,
    downloads: s?.downloads ?? 0,
    watchSeconds: s?.watchSeconds ?? 0,
    lastAt: s?.lastAt ?? null,
  }
}

function rateClass(rate: number | null) {
  if (rate === null) return 'text-gray-400 bg-gray-50 border-gray-100'
  if (rate >= 60) return 'text-emerald-700 bg-emerald-50 border-emerald-100'
  if (rate >= 25) return 'text-amber-700 bg-amber-50 border-amber-100'
  return 'text-red-600 bg-red-50 border-red-100'
}

function fmtWatch(seconds: number) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}
function fmtWhen(iso: string | null) {
  if (!iso) return 'Never opened'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Stats dialog — who has and hasn't opened it
const statsDlg = ref(false)
const statsItem = ref<Item | null>(null)
const peopleById = ref<Record<string, string>>({})
function openStats(it: Item) { statsItem.value = it; statsDlg.value = true }

const statsDetail = computed(() => {
  const it = statsItem.value
  if (!it) return null
  const e = engagementFor(it)
  const reachedSet = new Set(e.reached)
  return {
    ...e,
    openedBy: e.reached.map(id => peopleById.value[id] ?? 'Unknown').sort(),
    notOpenedBy: e.audienceIds.filter(id => !reachedSet.has(id)).map(id => peopleById.value[id] ?? 'Unknown').sort(),
  }
})

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

// Resource dialog — adds a link/video, and EDITS any resource (an uploaded file's
// title is otherwise stuck as its filename forever). A file's URL isn't editable:
// it points at the upload, so only links and videos show the URL field.
const linkDlg = ref(false)
const editKind = ref<Item['kind']>('link')
const editingItemId = ref<string | null>(null)
const form = reactive({ title: '', url: '', description: '' })
const urlEditable = computed(() => editKind.value === 'link' || editKind.value === 'video')
const canSaveItem = computed(() => !!form.title.trim() && (!urlEditable.value || !!form.url.trim()))

function openLinkDlg(kind: 'link' | 'video') {
  editingItemId.value = null; editKind.value = kind
  form.title = ''; form.url = ''; form.description = ''
  linkDlg.value = true
}
function openEditItem(it: Item) {
  editingItemId.value = it.id
  editKind.value = it.kind
  form.title = it.title; form.url = it.url; form.description = it.description ?? ''
  linkDlg.value = true
}
async function saveLink() {
  if (!canSaveItem.value) return
  const patch: any = { title: form.title.trim(), description: form.description.trim() || null }
  if (urlEditable.value) patch.url = form.url.trim()
  if (editingItemId.value) {
    await updateResource(editingItemId.value, patch)
  } else {
    await createResource({ kind: editKind.value, title: patch.title, url: patch.url, description: patch.description, folderId: currentFolderId.value, sortOrder: folderItems.value.length })
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
const delDlg = ref(false)
const delTarget = reactive<{ type: 'folder' | 'resource'; id: string | null; name: string; contains: number }>(
  { type: 'resource', id: null, name: '', contains: 0 })
function removeFolder(f: Folder) {
  delTarget.type = 'folder'; delTarget.id = f.id; delTarget.name = f.name
  delTarget.contains = deepCountIn(f.id)
  delDlg.value = true
}
function removeItem(it: Item) {
  delTarget.type = 'resource'; delTarget.id = it.id; delTarget.name = it.title
  delTarget.contains = 0
  delDlg.value = true
}
async function confirmDelete() {
  if (!delTarget.id) return
  if (delTarget.type === 'folder') await deleteFolder(delTarget.id)
  else await deleteResource(delTarget.id)
  delDlg.value = false
  await load()
  toast.add({ severity: 'success', summary: 'Deleted', life: 2000 })
}

// ---- Drag: move into a folder, or reorder among siblings ----
// Cursor position decides which: the middle of a folder tile means "put it inside",
// the outer edges of a tile/row mean "put it before/after me" (standing rule: ordering is drag).
const dragging = ref<{ type: 'folder' | 'resource'; id: string } | null>(null)
const dropHint = ref<{ id: string; zone: 'before' | 'after' | 'inside' } | null>(null)

function onDragStart(type: 'folder' | 'resource', id: string) { dragging.value = { type, id } }
function onDragEnd() { dragging.value = null; dropHint.value = null }

/** Where in this tile/row is the cursor? `allowInside` is false for resource rows (they hold nothing). */
function zoneFor(e: DragEvent, el: HTMLElement, allowInside: boolean, horizontal: boolean): 'before' | 'after' | 'inside' {
  const r = el.getBoundingClientRect()
  const ratio = horizontal ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height
  if (!allowInside) return ratio < 0.5 ? 'before' : 'after'
  if (ratio < 0.25) return 'before'
  if (ratio > 0.75) return 'after'
  return 'inside'
}

function onDragOverFolder(e: DragEvent, f: Folder) {
  const d = dragging.value
  if (!d) return
  if (d.type === 'folder' && d.id === f.id) { dropHint.value = null; return }
  // Reordering only makes sense between siblings sitting side by side in this grid.
  const canReorder = d.type === 'folder' && !searching.value && foldersById.value[d.id]?.parent_id === f.parent_id
  const zone = canReorder
    ? zoneFor(e, e.currentTarget as HTMLElement, true, true)   // tiles sit in a row: edges are left/right
    : 'inside'
  dropHint.value = { id: f.id, zone }
}

function onDropFolder(f: Folder) {
  const d = dragging.value
  const hint = dropHint.value
  onDragEnd()
  if (!d || !hint) return
  if (d.type === 'folder' && d.id === f.id) return
  if (hint.zone === 'inside') { performMove(d.type, d.id, f.id); return }
  // Reorder: drop the dragged folder before/after this one among its siblings.
  const ids = subFolders.value.map(x => x.id).filter(id => id !== d.id)
  const at = ids.indexOf(f.id) + (hint.zone === 'after' ? 1 : 0)
  ids.splice(at, 0, d.id)
  applyFolderOrder(ids)
}

function onDragOverItem(e: DragEvent, it: Item) {
  if (!dragging.value || dragging.value.type !== 'resource' || searching.value) return
  const zone = zoneFor(e, e.currentTarget as HTMLElement, false, false)
  dropHint.value = dragging.value.id === it.id ? null : { id: it.id, zone }
}

function onDropItem(it: Item) {
  const d = dragging.value
  const hint = dropHint.value
  onDragEnd()
  if (!d || !hint || d.type !== 'resource' || d.id === it.id) return
  const ids = folderItems.value.map(x => x.id).filter(id => id !== d.id)
  const at = ids.indexOf(it.id) + (hint.zone === 'after' ? 1 : 0)
  ids.splice(at, 0, d.id)
  applyItemOrder(ids)
}

// Optimistic local reorder, then persist — a full reload would flash the old order.
async function applyFolderOrder(ids: string[]) {
  ids.forEach((id, i) => { const f = foldersById.value[id]; if (f) f.sort_order = i })
  folders.value = [...folders.value].sort((a, b) => a.sort_order - b.sort_order)
  await reorderFolders(ids)
}
async function applyItemOrder(ids: string[]) {
  const byId = Object.fromEntries(items.value.map(i => [i.id, i]))
  ids.forEach((id, i) => { if (byId[id]) byId[id].sort_order = i })
  items.value = [...items.value].sort((a, b) => a.sort_order - b.sort_order)
  await reorderResources(ids)
}

function onDropCrumb(folderId: string | null) {
  const d = dragging.value
  onDragEnd()
  if (!d) return
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
        { label: 'Engagement', icon: 'pi pi-chart-bar', command: () => openStats(item) },
        { label: 'Connect audience', icon: 'pi pi-users', command: () => openConnect(item, 'resource') },
        { label: 'Edit', icon: 'pi pi-pencil', command: () => openEditItem(item) },
        { label: 'Move', icon: 'pi pi-arrows-alt', command: () => openMove(item, 'resource') },
        { separator: true },
        { label: 'Delete', icon: 'pi pi-trash', class: 'text-red-500', command: () => removeItem(item) },
      ]
  rowMenu.value.toggle(e)
}
</script>

<template>
  <div class="p-3 sm:p-6 flex gap-5">
    <input ref="fileInput" type="file" class="hidden" @change="onFileChosen" />

    <!-- Folder tree (desktop) — the whole hierarchy at a glance + a drop target per folder -->
    <aside class="hidden md:block w-56 shrink-0">
      <div class="card p-2 sticky top-4">
        <button
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left"
          :class="currentFolderId === null ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'"
          @click="goToFolder(null)"
          @dragover.prevent @drop.prevent="onDropTree(null)">
          <i class="pi pi-home text-xs" />
          <span class="truncate">Resources</span>
        </button>

        <div v-for="{ folder: f, depth } in treeRows" :key="f.id"
          class="flex items-center rounded-md"
          :class="currentFolderId === f.id ? 'bg-primary/10' : 'hover:bg-gray-50'"
          :style="{ paddingLeft: `${depth * 12}px` }"
          draggable="true"
          @dragstart="onDragStart('folder', f.id)" @dragend="onDragEnd"
          @dragover.prevent @drop.prevent="onDropTree(f.id)">
          <button class="w-5 h-7 flex items-center justify-center shrink-0 text-gray-400 hover:text-gray-700"
            @click.stop="toggleExpand(f.id)">
            <i v-if="hasChildren(f.id)" class="pi text-[10px]" :class="expanded[f.id] ? 'pi-chevron-down' : 'pi-chevron-right'" />
          </button>
          <button class="flex-1 min-w-0 flex items-center gap-2 py-1.5 pr-2 text-sm text-left"
            :class="currentFolderId === f.id ? 'text-primary font-medium' : 'text-gray-600'"
            @click="goToFolder(f.id)">
            <i class="pi pi-folder text-xs text-amber-500 shrink-0" />
            <span class="truncate">{{ f.name }}</span>
          </button>
        </div>

        <p v-if="!treeRows.length && !loading" class="text-xs text-gray-400 px-2 py-1.5">No folders yet.</p>
      </div>
    </aside>

    <div class="flex-1 min-w-0 space-y-4 sm:space-y-5">
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
        <IconField class="w-full sm:w-56">
          <InputIcon class="pi pi-search" />
          <InputText v-model="search" placeholder="Search resources" class="w-full" size="small" />
        </IconField>
        <Button label="Member view" icon="pi pi-eye" size="small" text class="shrink-0"
          v-tooltip.top="'What a member sees — only what\'s aimed at them'"
          @click="navigateTo('/resources/library')" />
        <Button label="New folder" icon="pi pi-folder" size="small" outlined class="shrink-0" @click="openNewFolder" />
        <Button label="Add resource" icon="pi pi-plus" size="small" :loading="uploading"
          style="background:#1E2157;border-color:#1E2157" class="shrink-0"
          @click="(e:any) => addMenu.toggle(e)" />
        <Menu ref="addMenu" :model="addModel" popup />
      </div>
    </div>

    <div v-if="loading" class="text-sm text-gray-400 py-10 text-center">Loading…</div>

    <!-- Search: one flat view across the whole library, each result showing where it lives -->
    <template v-else-if="searching">
      <div v-if="noResults" class="card p-10 text-center">
        <i class="pi pi-search text-3xl text-gray-300 block mb-2" />
        <p class="text-sm text-gray-500">Nothing matches “{{ search }}”.</p>
      </div>
      <template v-else>
        <div v-if="results.folders.length" class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Folders</p>
          <div class="card divide-y divide-gray-100">
            <button v-for="f in results.folders" :key="f.id"
              class="w-full flex items-center gap-3 px-3 sm:px-4 py-2.5 text-left hover:bg-gray-50"
              @click="goToFolder(f.id)">
              <div class="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                <i class="pi pi-folder text-amber-500" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-gray-800 truncate">{{ f.name }}</p>
                <p class="text-xs text-gray-400 truncate">in {{ locationOf(f.parent_id) }}</p>
              </div>
              <i class="pi pi-angle-right text-gray-300 shrink-0" />
            </button>
          </div>
        </div>

        <div v-if="results.items.length" class="space-y-2">
          <p class="text-xs font-bold uppercase tracking-wide text-gray-400">Resources</p>
          <div class="card divide-y divide-gray-100">
            <div v-for="it in results.items" :key="it.id" class="flex items-center gap-3 px-3 sm:px-4 py-2.5">
              <img v-if="it.kind === 'image'" :src="it.url" alt=""
                class="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" />
              <div v-else class="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                <i class="pi" :class="kindIcon(it.kind)" style="color:#6B7280" />
              </div>
              <div class="min-w-0 flex-1">
                <a :href="it.url" target="_blank" class="text-sm font-medium text-gray-800 hover:text-primary truncate block">{{ it.title }}</a>
                <button class="text-xs text-gray-400 hover:text-primary truncate block" @click="goToFolder(it.folder_id)">
                  in {{ locationOf(it.folder_id) }}
                </button>
              </div>
              <button class="text-gray-300 hover:text-gray-600 shrink-0" @click="openRowMenu($event, it, 'resource')"><i class="pi pi-ellipsis-v" /></button>
            </div>
          </div>
        </div>
      </template>
    </template>

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
            class="card p-3 flex items-start gap-3 cursor-pointer transition-colors relative"
            :class="[
              dropHint?.id === f.id && dropHint?.zone === 'inside' ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
              dropHint?.id === f.id && dropHint?.zone === 'before' ? 'res-drop-left' : '',
              dropHint?.id === f.id && dropHint?.zone === 'after' ? 'res-drop-right' : '',
            ]"
            @dragstart="onDragStart('folder', f.id)" @dragend="onDragEnd"
            @dragover.prevent="onDragOverFolder($event, f)" @dragleave="dropHint = null"
            @drop.prevent="onDropFolder(f)"
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
            class="flex items-center gap-3 px-3 sm:px-4 py-2.5 relative"
            :class="[
              dropHint?.id === it.id && dropHint?.zone === 'before' ? 'res-drop-before' : '',
              dropHint?.id === it.id && dropHint?.zone === 'after' ? 'res-drop-after' : '',
            ]"
            @dragstart="onDragStart('resource', it.id)" @dragend="onDragEnd"
            @dragover.prevent="onDragOverItem($event, it)" @dragleave="dropHint = null"
            @drop.prevent="onDropItem(it)">
            <img v-if="it.kind === 'image'" :src="it.url" alt=""
              class="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" />
            <div v-else class="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
              <i class="pi" :class="kindIcon(it.kind)" style="color:#6B7280" />
            </div>
            <div class="min-w-0 flex-1">
              <a :href="it.url" target="_blank" class="text-sm font-medium text-gray-800 hover:text-primary truncate block">{{ it.title }}</a>
              <p v-if="it.description" class="text-xs text-gray-500 truncate">{{ it.description }}</p>
              <div class="flex items-center gap-2 flex-wrap mt-0.5">
                <span class="text-xs text-gray-400">{{ kindLabel(it.kind) }}</span>
                <AudienceBadges :audience="audienceFor(it, 'resource')" />
              </div>
            </div>
            <!-- How many of the people it's aimed at have actually opened it -->
            <button
              class="shrink-0 text-xs px-2 py-0.5 rounded-full border tabular-nums"
              :class="rateClass(engagementFor(it).rate)"
              v-tooltip.top="`${engagementFor(it).reachedCount} of ${engagementFor(it).audienceCount} opened · ${engagementFor(it).opens} opens`"
              @click="openStats(it)">
              {{ engagementFor(it).rate === null ? 'No audience' : `${engagementFor(it).rate}%` }}
            </button>
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

    <!-- Add / edit a resource -->
    <Dialog v-model:visible="linkDlg" modal :style="{ width: '95vw', maxWidth: '480px' }"
      :header="editingItemId ? 'Edit resource' : (editKind === 'video' ? 'Add video link' : 'Add website link')">
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">Title</label>
          <InputText v-model="form.title" class="w-full" placeholder="e.g. Coaching drills video" @keyup.enter="saveLink" />
        </div>
        <div v-if="urlEditable">
          <label class="text-xs font-medium text-gray-500 block mb-1">{{ editKind === 'video' ? 'Video URL (YouTube, Vimeo…)' : 'Website URL' }}</label>
          <InputText v-model="form.url" class="w-full" placeholder="https://…" />
        </div>
        <div v-else class="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
          <i class="pi" :class="kindIcon(editKind)" />
          <span class="truncate">{{ form.url }}</span>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-500 block mb-1">Description <span class="text-gray-300">(optional)</span></label>
          <Textarea v-model="form.description" class="w-full" rows="2" autoResize />
        </div>
      </div>
      <template #footer>
        <Button label="Cancel" text @click="linkDlg = false" />
        <Button :label="editingItemId ? 'Save' : 'Add'" :disabled="!canSaveItem"
          style="background:#1E2157;border-color:#1E2157" @click="saveLink" />
      </template>
    </Dialog>

    <!-- Delete confirm -->
    <Dialog v-model:visible="delDlg" modal :style="{ width: '95vw', maxWidth: '420px' }"
      :header="delTarget.type === 'folder' ? 'Delete folder' : 'Delete resource'">
      <p class="text-sm text-gray-700">Delete <span class="font-medium">{{ delTarget.name }}</span>?</p>
      <p v-if="delTarget.contains" class="text-sm text-red-600 mt-2">
        This also deletes the {{ delTarget.contains }} item{{ delTarget.contains === 1 ? '' : 's' }} inside it. This can't be undone.
      </p>
      <p v-else class="text-xs text-gray-400 mt-2">This can't be undone.</p>
      <template #footer>
        <Button label="Cancel" text @click="delDlg = false" />
        <Button label="Delete" severity="danger" @click="confirmDelete" />
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

    <!-- Engagement -->
    <Dialog v-model:visible="statsDlg" modal :style="{ width: '95vw', maxWidth: '560px' }"
      :header="statsItem?.title ?? 'Engagement'">
      <div v-if="statsDetail" class="space-y-4">
        <!-- The headline: reach against the audience it was aimed at -->
        <div class="card p-4">
          <div class="flex items-end justify-between mb-2">
            <div>
              <p class="text-2xl font-bold text-gray-800 tabular-nums">
                {{ statsDetail.rate === null ? '—' : `${statsDetail.rate}%` }}
              </p>
              <p class="text-xs text-gray-500">
                {{ statsDetail.reachedCount }} of {{ statsDetail.audienceCount }}
                {{ statsDetail.audienceCount === 1 ? 'person' : 'people' }} it's aimed at have opened it
              </p>
            </div>
            <p class="text-xs text-gray-400">{{ fmtWhen(statsDetail.lastAt) }}</p>
          </div>
          <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-full rounded-full bg-primary transition-all" :style="{ width: `${statsDetail.rate ?? 0}%` }" />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="card p-3 text-center">
            <p class="text-lg font-bold text-gray-800 tabular-nums">{{ statsDetail.opens }}</p>
            <p class="text-xs text-gray-400">Opens</p>
          </div>
          <div class="card p-3 text-center">
            <p class="text-lg font-bold text-gray-800 tabular-nums">{{ statsDetail.downloads }}</p>
            <p class="text-xs text-gray-400">Downloads</p>
          </div>
          <div class="card p-3 text-center">
            <p class="text-lg font-bold text-gray-800 tabular-nums">{{ fmtWatch(statsDetail.watchSeconds) }}</p>
            <p class="text-xs text-gray-400">Time viewed</p>
          </div>
        </div>

        <div v-if="!statsDetail.audienceCount" class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          Nobody is in this resource's audience yet, so there's no rate to measure. Connect it to a group or member type.
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">
              Opened ({{ statsDetail.openedBy.length }})
            </p>
            <div class="card p-2 max-h-40 overflow-y-auto">
              <p v-for="n in statsDetail.openedBy" :key="n" class="text-sm text-gray-700 px-1 py-0.5 truncate">{{ n }}</p>
              <p v-if="!statsDetail.openedBy.length" class="text-xs text-gray-400 px-1 py-0.5">Nobody yet.</p>
            </div>
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">
              Not yet ({{ statsDetail.notOpenedBy.length }})
            </p>
            <div class="card p-2 max-h-40 overflow-y-auto">
              <p v-for="n in statsDetail.notOpenedBy" :key="n" class="text-sm text-gray-700 px-1 py-0.5 truncate">{{ n }}</p>
              <p v-if="!statsDetail.notOpenedBy.length" class="text-xs text-emerald-600 px-1 py-0.5">Everyone has opened it.</p>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Close" style="background:#1E2157;border-color:#1E2157" @click="statsDlg = false" />
      </template>
    </Dialog>

    <!-- Connect audience dialog -->
    <ResourceConnectDialog v-model:visible="connectDlg"
      :owner-type="connectOwner.type" :owner-id="connectOwner.id" :name="connectOwner.name"
      :can-inherit="connectOwner.canInherit" :override="connectOwner.override"
      :inherited-summary="connectOwner.inheritedSummary" @saved="load" />
    </div>
  </div>
</template>

<style scoped>
/* Drop lines: where the dragged thing will land when you let go. */
.res-drop-before::before,
.res-drop-after::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--brand-primary);
  border-radius: 2px;
}
.res-drop-before::before { top: -1px; }
.res-drop-after::after { bottom: -1px; }

/* Folder tiles sit side by side, so their drop line is vertical. */
.res-drop-left::before,
.res-drop-right::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--brand-primary);
  border-radius: 2px;
}
.res-drop-left::before { left: -7px; }
.res-drop-right::after { right: -7px; }
</style>
