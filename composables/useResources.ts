// Resources — a tagged, hierarchical file/link library (migration 246).
//
// Folders nest (resource_folders.parent_id); resources live in a folder or at root
// (resources.folder_id). Any folder OR resource connects to person types / groups via
// the polymorphic resource_targets table (owner_type 'folder'|'resource'). A folder's
// audience CASCADES to everything inside it; an item can OVERRIDE with its own audience
// (override_targets = true). Mirrors registration_form_targets (229) delete-then-insert.

export interface ResourceFolder {
  id: string
  org_id: string
  parent_id: string | null
  name: string
  override_targets: boolean
  sort_order: number
  created_at?: string
}

export type ResourceKind = 'pdf' | 'link' | 'video' | 'image' | 'file'

export interface ResourceItem {
  id: string
  org_id: string
  folder_id: string | null
  kind: ResourceKind
  title: string
  url: string
  description: string | null
  override_targets: boolean
  sort_order: number
  created_at?: string
}

export interface ResourceTarget {
  owner_type: 'folder' | 'resource'
  owner_id: string
  target_type: 'group' | 'person_type'
  target_id: string
  sort_order?: number
}

export function ownerKey(ownerType: 'folder' | 'resource', id: string) {
  return `${ownerType}:${id}`
}

/** What happened to one resource (migration 260). */
export interface ResourceStats {
  opens: number
  downloads: number
  watchSeconds: number
  viewerIds: string[]            // distinct people; admins with no persons row are excluded
  lastAt: string | null
}

/** Enough to size any resource's audience client-side, from one wave of queries. */
export interface AudienceIndex {
  byType: Record<string, string[]>    // person ids per person-type id
  byGroup: Record<string, string[]>   // person ids per group id
  everyone: string[]                  // the audience of an untargeted resource
}

const KIND_META: Record<ResourceKind, { label: string; icon: string }> = {
  pdf: { label: 'PDF', icon: 'pi-file-pdf' },
  link: { label: 'Website link', icon: 'pi-link' },
  video: { label: 'Video', icon: 'pi-video' },
  image: { label: 'Image', icon: 'pi-image' },
  file: { label: 'File', icon: 'pi-file' },
}

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'heif', 'bmp', 'tiff', 'tif', 'avif']
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv']
const PDF_EXT = ['pdf']

export function useResources() {
  const { orgId } = useOrg()
  const api = useResourcesApi()

  // Map the seam's camelCase domain objects back to the snake_case shapes this
  // composable has always exposed, so its callers (both resources pages) are
  // untouched by the move onto the /api/v1 seam.
  const toFolder = (f: any): ResourceFolder => ({
    id: f.id, org_id: f.orgId, parent_id: f.parentId ?? null,
    name: f.name, override_targets: f.overrideTargets, sort_order: f.sortOrder,
  })
  const toItem = (r: any): ResourceItem => ({
    id: r.id, org_id: r.orgId, folder_id: r.folderId ?? null, kind: r.kind,
    title: r.title, url: r.url, description: r.description ?? null,
    override_targets: r.overrideTargets, sort_order: r.sortOrder,
  })
  const toTarget = (t: any): ResourceTarget => ({
    owner_type: t.ownerType, owner_id: t.ownerId,
    target_type: t.targetType, target_id: t.targetId,
  })

  // ---- Folders ----
  async function loadFolders(): Promise<ResourceFolder[]> {
    return (await api.folders(orgId.value)).map(toFolder)
  }

  async function createFolder(name: string, parentId: string | null, sortOrder = 0): Promise<ResourceFolder | null> {
    return toFolder(await api.createFolder({ orgId: orgId.value, name, parentId, sortOrder }))
  }

  async function renameFolder(id: string, name: string) {
    await api.updateFolder(id, { name })
  }

  async function moveFolder(id: string, parentId: string | null) {
    await api.updateFolder(id, { parentId })
  }

  async function deleteFolder(id: string) {
    // Children cascade via FK; the repo also cleans this folder's own target rows.
    await api.removeFolder(id)
  }

  async function reorderFolders(ids: string[]) {
    await api.reorderFolders(orgId.value, ids)
  }

  // ---- Resources ----
  async function loadResources(): Promise<ResourceItem[]> {
    return (await api.resources(orgId.value)).map(toItem)
  }

  async function createResource(
    payload: { kind: ResourceKind; title: string; url: string; description?: string | null; folderId: string | null; sortOrder?: number },
  ): Promise<ResourceItem | null> {
    return toItem(await api.create({
      orgId: orgId.value,
      folderId: payload.folderId,
      kind: payload.kind,
      title: payload.title,
      url: payload.url,
      description: payload.description ?? null,
      sortOrder: payload.sortOrder ?? 0,
    }))
  }

  async function updateResource(id: string, patch: Partial<Pick<ResourceItem, 'title' | 'url' | 'description' | 'kind'>>) {
    await api.update(id, patch)
  }

  async function moveResource(id: string, folderId: string | null) {
    await api.update(id, { folderId })
  }

  async function deleteResource(id: string) {
    // The repo removes this resource's own target rows too.
    await api.remove(id)
  }

  async function reorderResources(ids: string[]) {
    await api.reorderResources(orgId.value, ids)
  }

  async function setOverride(ownerType: 'folder' | 'resource', id: string, value: boolean) {
    if (ownerType === 'folder') await api.updateFolder(id, { overrideTargets: value })
    else await api.update(id, { overrideTargets: value })
  }

  // ---- Targets ----
  /** All target rows for the org, bucketed by `${ownerType}:${ownerId}`. */
  async function loadAllTargets(): Promise<Record<string, ResourceTarget[]>> {
    const rows = (await api.allTargets(orgId.value)).map(toTarget)
    const out: Record<string, ResourceTarget[]> = {}
    for (const t of rows) {
      const k = ownerKey(t.owner_type, t.owner_id)
      ;(out[k] ??= []).push(t)
    }
    return out
  }

  /** Save one owner's targets — delete-then-insert (mirrors FormConnectionsDialog). */
  async function saveTargets(ownerType: 'folder' | 'resource', ownerId: string, keyed: Record<string, { checked?: boolean }>) {
    const targets = Object.entries(keyed)
      .filter(([k, v]) => v?.checked && k.includes(':'))
      .map(([k]) => {
        const [type, id] = k.split(':')
        return { targetType: type, targetId: id }
      })
    return await api.saveTargets(orgId.value, ownerType, ownerId, targets)
  }

  /**
   * Effective audience for an item, honouring override/inherit.
   * Returns the resolved target rows + whether they were inherited from a folder.
   */
  function effectiveTargets(
    item: { id: string; override_targets: boolean; parent_id?: string | null; folder_id?: string | null },
    ownerType: 'folder' | 'resource',
    targetsByOwner: Record<string, ResourceTarget[]>,
    foldersById: Record<string, ResourceFolder>,
  ): { targets: ResourceTarget[]; inherited: boolean; sourceId: string | null } {
    const parentId = ownerType === 'folder' ? (item.parent_id ?? null) : (item.folder_id ?? null)
    if (item.override_targets || !parentId) {
      return { targets: targetsByOwner[ownerKey(ownerType, item.id)] ?? [], inherited: false, sourceId: item.id }
    }
    const parent = foldersById[parentId]
    if (!parent) return { targets: targetsByOwner[ownerKey(ownerType, item.id)] ?? [], inherited: false, sourceId: item.id }
    const eff = effectiveTargets(parent, 'folder', targetsByOwner, foldersById)
    return { targets: eff.targets, inherited: true, sourceId: eff.sourceId }
  }

  // ---- Engagement (migration 260) ----
  //
  // An "open rate" is only meaningful against a denominator, so this section does two
  // things: log what happened (resource_views), and resolve WHO a resource was aimed at
  // (its effective targets → groups / person types → distinct people). A resource with
  // no targets is aimed at everyone, so its denominator is the whole club.

  /** The signed-in user's persons row, resolved once per session (views are per-person).
   *  Resolution crosses into the people domain via its seam (a name/email search that
   *  matches the exact email), not a raw persons query. */
  const myPersonId = useState<string | null>('resource_view_person', () => null)
  const myPersonResolved = useState<boolean>('resource_view_person_resolved', () => false)
  async function resolveMyPersonId(): Promise<string | null> {
    if (myPersonResolved.value) return myPersonId.value
    myPersonResolved.value = true
    const user = useSupabaseUser().value
    if (!user?.email) return null
    const email = user.email.toLowerCase()
    const matches = await usePeopleApi().list(orgId.value, { q: user.email })
    myPersonId.value = matches.find(p => (p.email ?? '').toLowerCase() === email)?.id ?? null
    return myPersonId.value
  }

  /**
   * Record an interaction. Fire-and-forget by design — a failed log must never block
   * someone from opening a document, so this swallows its own errors.
   */
  async function logView(
    resourceId: string,
    kind: 'open' | 'download' | 'watch' = 'open',
    opts: { seconds?: number; source?: 'library' | 'admin' } = {},
  ) {
    try {
      const user = useSupabaseUser().value
      await api.logView({
        orgId: orgId.value,
        resourceId,
        personId: await resolveMyPersonId(),
        userId: user?.id ?? null,
        kind,
        seconds: opts.seconds ?? null,
        source: opts.source ?? 'library',
      })
    } catch { /* engagement logging is never worth breaking a click over */ }
  }

  /** Every view row for the org, folded into per-resource stats. */
  async function loadViewStats(): Promise<Record<string, ResourceStats>> {
    const rows = await api.viewsByOrg(orgId.value)
    const out: Record<string, ResourceStats & { _viewers: Set<string> }> = {}
    for (const v of rows) {
      const s = (out[v.resourceId] ??= { opens: 0, downloads: 0, watchSeconds: 0, viewerIds: [], lastAt: null, _viewers: new Set() })
      if (v.kind === 'download') s.downloads++
      else if (v.kind === 'watch') s.watchSeconds += v.seconds ?? 0
      else s.opens++
      if (v.personId) s._viewers.add(v.personId)
      if (!s.lastAt || v.createdAt > s.lastAt) s.lastAt = v.createdAt
    }
    const stats: Record<string, ResourceStats> = {}
    for (const [id, s] of Object.entries(out)) {
      stats[id] = { opens: s.opens, downloads: s.downloads, watchSeconds: s.watchSeconds, viewerIds: [...s._viewers], lastAt: s.lastAt }
    }
    return stats
  }

  /** One wave of queries; enough to size any resource's audience client-side. Composed
   *  from the people / person-type / groups seams (this domain owns none of them). */
  async function loadAudienceIndex(): Promise<AudienceIndex> {
    const [people, types, memberships] = await Promise.all([
      usePeopleApi().list(orgId.value),
      usePersonTypesApi().listTypes(orgId.value),
      useGroupsApi().membershipsByOrg(orgId.value),
    ])
    const byType: Record<string, string[]> = {}
    for (const t of types) {
      // resource_targets stores the TYPE's id; a person carries type KEYS.
      byType[t.id] = people.filter(p => (p.personTypes ?? []).includes(t.key)).map(p => p.id)
    }
    const inOrg = new Set(people.map(p => p.id))
    const byGroup: Record<string, string[]> = {}
    for (const m of memberships) {
      if (!inOrg.has(m.personId)) continue   // scope memberships via people in this org
      ;(byGroup[m.groupId] ??= []).push(m.personId)
    }
    return { byType, byGroup, everyone: people.map(p => p.id) }
  }

  /** Who can see this thing — distinct person ids. No targets = the whole club. */
  function audiencePersonIds(targets: ResourceTarget[], idx: AudienceIndex): string[] {
    if (!targets.length) return idx.everyone
    const set = new Set<string>()
    for (const t of targets) {
      const ids = t.target_type === 'group' ? idx.byGroup[t.target_id] : idx.byType[t.target_id]
      for (const id of ids ?? []) set.add(id)
    }
    return [...set]
  }

  // ---- Kind helpers ----
  function kindFromFilename(name: string): ResourceKind {
    const ext = (name.split('.').pop() || '').toLowerCase()
    if (IMAGE_EXT.includes(ext)) return 'image'
    if (VIDEO_EXT.includes(ext)) return 'video'
    if (PDF_EXT.includes(ext)) return 'pdf'
    return 'file'
  }
  const kindIcon = (k: ResourceKind) => KIND_META[k]?.icon ?? 'pi-file'
  const kindLabel = (k: ResourceKind) => KIND_META[k]?.label ?? 'File'

  return {
    loadFolders, createFolder, renameFolder, moveFolder, deleteFolder, reorderFolders,
    loadResources, createResource, updateResource, moveResource, deleteResource, reorderResources,
    setOverride, loadAllTargets, saveTargets, effectiveTargets,
    logView, loadViewStats, loadAudienceIndex, audiencePersonIds, resolveMyPersonId,
    kindFromFilename, kindIcon, kindLabel,
  }
}
