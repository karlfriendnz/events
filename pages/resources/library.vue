<!--
  Resource library — the MEMBER-facing view (the counterpart to the admin explorer at
  /resources). A person sees only what's aimed at them: a resource's effective audience
  (its own targets, or its folder's when it doesn't override) is matched against the
  person's types and group memberships. No targets at all = everyone.

  This page is also where engagement comes from (migration 260): opening a resource logs
  an 'open', pulling a file down logs a 'download', and a video/document viewed in the
  built-in viewer logs a 'watch' with its dwell time on close. Without this page the
  admin stats would read 0% forever — there'd be nowhere for a member to open anything.
-->
<script setup lang="ts">
const {
  loadFolders, loadResources, loadAllTargets, effectiveTargets,
  logView, resolveMyPersonId, kindIcon, kindLabel,
} = useResources()

const { orgId } = useOrg()

useBreadcrumbs([{ label: 'Resources', to: '/resources' }, { label: 'Library' }])

type Folder = Awaited<ReturnType<typeof loadFolders>>[number]
type Item = Awaited<ReturnType<typeof loadResources>>[number]

const folders = ref<Folder[]>([])
const items = ref<Item[]>([])
const targetsByOwner = ref<Record<string, any[]>>({})
const myTypeIds = ref<string[]>([])
const myGroupIds = ref<string[]>([])
const knownPerson = ref(true)
const currentFolderId = ref<string | null>(null)
const search = ref('')
const loading = ref(true)

const foldersById = computed<Record<string, Folder>>(() =>
  Object.fromEntries(folders.value.map(f => [f.id, f])))

async function load() {
  loading.value = true
  const personId = await resolveMyPersonId()
  knownPerson.value = !!personId

  const [fs, rs, tg] = await Promise.all([loadFolders(), loadResources(), loadAllTargets()])
  folders.value = fs
  items.value = rs
  targetsByOwner.value = tg

  if (personId) {
    const [me, types, mems] = await Promise.all([
      usePeopleApi().get(personId),
      usePersonTypesApi().listTypes(orgId.value),
      useGroupsApi().membershipsByOrg(orgId.value),
    ])
    // Targets store the person-TYPE's id; the person carries type keys — map across.
    const myKeys: string[] = me.personTypes ?? []
    myTypeIds.value = types.filter(t => myKeys.includes(t.key)).map(t => t.id)
    myGroupIds.value = mems.filter(m => m.personId === personId).map(m => m.groupId)
  }
  loading.value = false
}
onMounted(load)

/** Is this thing aimed at me? Untargeted = aimed at everyone. */
function visibleToMe(item: any, ownerType: 'folder' | 'resource') {
  const { targets } = effectiveTargets(item, ownerType, targetsByOwner.value, foldersById.value)
  if (!targets.length) return true
  return targets.some((t: any) => t.target_type === 'group'
    ? myGroupIds.value.includes(t.target_id)
    : myTypeIds.value.includes(t.target_id))
}

const myItems = computed(() => items.value.filter(i => visibleToMe(i, 'resource')))
const myFolders = computed(() => folders.value.filter(f => visibleToMe(f, 'folder')))

/** A folder is worth showing only if something I can see is somewhere inside it. */
function folderHasContent(id: string): boolean {
  if (myItems.value.some(i => i.folder_id === id)) return true
  return myFolders.value.filter(f => f.parent_id === id).some(f => folderHasContent(f.id))
}

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

const searching = computed(() => search.value.trim().length > 0)
const subFolders = computed(() =>
  myFolders.value.filter(f => f.parent_id === currentFolderId.value && folderHasContent(f.id)))
const folderItems = computed(() => {
  if (searching.value) {
    const q = search.value.trim().toLowerCase()
    return myItems.value.filter(i =>
      i.title.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q))
  }
  return myItems.value.filter(i => i.folder_id === currentFolderId.value)
})
const isEmpty = computed(() => !subFolders.value.length && !folderItems.value.length)

// ---- Opening things (this is what engagement is made of) ----
const viewer = ref<Item | null>(null)
const openedAt = ref(0)

/** Files and videos open in the viewer (so we can time them); plain links leave the app. */
function openItem(it: Item) {
  if (it.kind === 'link') {
    logView(it.id, 'open', { source: 'library' })
    window.open(it.url, '_blank')
    return
  }
  viewer.value = it
  openedAt.value = Date.now()
  logView(it.id, 'open', { source: 'library' })
}

/** Dwell: one 'watch' row per viewing session, stamped with how long it was open. */
function closeViewer() {
  const it = viewer.value
  if (it) {
    const seconds = Math.round((Date.now() - openedAt.value) / 1000)
    if (seconds >= 3) logView(it.id, 'watch', { seconds, source: 'library' })
  }
  viewer.value = null
}

function download(it: Item) {
  logView(it.id, 'download', { source: 'library' })
  const a = document.createElement('a')
  a.href = it.url
  a.download = it.title
  a.target = '_blank'
  a.click()
}

/** YouTube/Vimeo watch URLs don't render in an iframe — swap to their embed form. */
const embedUrl = computed(() => {
  const url = viewer.value?.url ?? ''
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vimeo = url.match(/vimeo\.com\/(\d+)/)
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`
  return url
})
const isUploadedVideo = computed(() => {
  const u = viewer.value?.url ?? ''
  return /\.(mp4|webm|mov|m4v)$/i.test(u)
})
</script>

<template>
  <div class="p-3 sm:p-6 space-y-4 sm:space-y-5">
    <!-- Where am I -->
    <div class="flex flex-col sm:flex-row sm:items-center gap-3">
      <nav class="flex items-center gap-1 text-sm min-w-0 overflow-x-auto no-scrollbar">
        <button class="shrink-0 px-2 py-1 rounded-md hover:bg-gray-100 text-gray-600"
          :class="currentFolderId === null ? 'font-semibold text-gray-800' : ''"
          @click="currentFolderId = null">
          <i class="pi pi-home text-xs mr-1" />Library
        </button>
        <template v-for="f in path" :key="f.id">
          <i class="pi pi-angle-right text-gray-300 text-xs shrink-0" />
          <button class="shrink-0 px-2 py-1 rounded-md hover:bg-gray-100 truncate max-w-[40vw]"
            :class="f.id === currentFolderId ? 'font-semibold text-gray-800' : 'text-gray-600'"
            @click="currentFolderId = f.id">{{ f.name }}</button>
        </template>
      </nav>
      <IconField class="sm:ml-auto w-full sm:w-64">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" placeholder="Search the library" class="w-full" size="small" />
      </IconField>
    </div>

    <div v-if="loading" class="text-sm text-gray-400 py-10 text-center">Loading…</div>

    <div v-else-if="!knownPerson" class="card p-10 text-center">
      <i class="pi pi-user text-3xl text-gray-300 block mb-2" />
      <p class="text-sm text-gray-500">We can't match your login to a member record.</p>
      <p class="text-xs text-gray-400 mt-1">Ask your club to add you, and your resources will appear here.</p>
    </div>

    <div v-else-if="isEmpty" class="card p-10 text-center">
      <i class="pi pi-folder-open text-3xl text-gray-300 block mb-2" />
      <p class="text-sm text-gray-500">{{ searching ? `Nothing matches “${search}”.` : 'Nothing here yet.' }}</p>
    </div>

    <template v-else>
      <div v-if="subFolders.length && !searching" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button v-for="f in subFolders" :key="f.id"
          class="card p-3 flex items-center gap-3 text-left hover:border-primary/40 transition-colors"
          @click="currentFolderId = f.id">
          <div class="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
            <i class="pi pi-folder text-amber-500" />
          </div>
          <p class="text-sm font-medium text-gray-800 truncate flex-1">{{ f.name }}</p>
          <i class="pi pi-angle-right text-gray-300" />
        </button>
      </div>

      <div v-if="folderItems.length" class="card divide-y divide-gray-100">
        <div v-for="it in folderItems" :key="it.id" class="flex items-center gap-3 px-3 sm:px-4 py-3">
          <img v-if="it.kind === 'image'" :src="it.url" alt=""
            class="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0" />
          <div v-else class="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
            <i class="pi" :class="kindIcon(it.kind)" style="color:#6B7280" />
          </div>
          <button class="min-w-0 flex-1 text-left" @click="openItem(it)">
            <p class="text-sm font-medium text-gray-800 truncate hover:text-primary">{{ it.title }}</p>
            <p v-if="it.description" class="text-xs text-gray-500 truncate">{{ it.description }}</p>
            <p v-else class="text-xs text-gray-400">{{ kindLabel(it.kind) }}</p>
          </button>
          <Button v-if="it.kind !== 'link'" icon="pi pi-download" text rounded size="small"
            v-tooltip.top="'Download'" @click="download(it)" />
          <Button :icon="it.kind === 'link' ? 'pi pi-external-link' : 'pi pi-eye'" text rounded size="small"
            v-tooltip.top="it.kind === 'link' ? 'Open' : 'View'" @click="openItem(it)" />
        </div>
      </div>
    </template>

    <!-- Viewer: keeps the member in the app, which is the only way we can time a view -->
    <Dialog :visible="!!viewer" modal :header="viewer?.title" :style="{ width: '95vw', maxWidth: '900px' }"
      @update:visible="closeViewer">
      <div v-if="viewer" class="space-y-3">
        <img v-if="viewer.kind === 'image'" :src="viewer.url" :alt="viewer.title" class="w-full rounded-lg" />
        <video v-else-if="viewer.kind === 'video' && isUploadedVideo" :src="viewer.url" controls class="w-full rounded-lg" />
        <iframe v-else :src="embedUrl" class="w-full h-[65vh] rounded-lg border border-gray-100"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen />
        <p v-if="viewer.description" class="text-sm text-gray-600">{{ viewer.description }}</p>
      </div>
      <template #footer>
        <Button v-if="viewer && viewer.kind !== 'link'" label="Download" icon="pi pi-download" text @click="download(viewer)" />
        <Button label="Close" style="background:#1E2157;border-color:#1E2157" @click="closeViewer" />
      </template>
    </Dialog>
  </div>
</template>
