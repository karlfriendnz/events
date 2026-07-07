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
  const db = useDb()
  const { orgId } = useOrg()

  // ---- Folders ----
  async function loadFolders(): Promise<ResourceFolder[]> {
    const { data } = await (db.from as any)('resource_folders')
      .select('id, org_id, parent_id, name, override_targets, sort_order, created_at')
      .eq('org_id', orgId.value).order('sort_order')
    return data ?? []
  }

  async function createFolder(name: string, parentId: string | null, sortOrder = 0): Promise<ResourceFolder | null> {
    const { data } = await (db.from as any)('resource_folders')
      .insert({ org_id: orgId.value, parent_id: parentId, name, sort_order: sortOrder })
      .select('id, org_id, parent_id, name, override_targets, sort_order, created_at').single()
    return data ?? null
  }

  async function renameFolder(id: string, name: string) {
    await (db.from as any)('resource_folders').update({ name }).eq('id', id)
  }

  async function moveFolder(id: string, parentId: string | null) {
    await (db.from as any)('resource_folders').update({ parent_id: parentId }).eq('id', id)
  }

  async function deleteFolder(id: string) {
    // Children cascade via FK; clean up this folder's own target rows.
    await (db.from as any)('resource_targets').delete().eq('owner_type', 'folder').eq('owner_id', id)
    await (db.from as any)('resource_folders').delete().eq('id', id)
  }

  async function reorderFolders(ids: string[]) {
    await Promise.all(ids.map((id, i) =>
      (db.from as any)('resource_folders').update({ sort_order: i }).eq('id', id)))
  }

  // ---- Resources ----
  async function loadResources(): Promise<ResourceItem[]> {
    const { data } = await (db.from as any)('resources')
      .select('id, org_id, folder_id, kind, title, url, description, override_targets, sort_order, created_at')
      .eq('org_id', orgId.value).order('sort_order')
    return data ?? []
  }

  async function createResource(
    payload: { kind: ResourceKind; title: string; url: string; description?: string | null; folderId: string | null; sortOrder?: number },
  ): Promise<ResourceItem | null> {
    const { data } = await (db.from as any)('resources').insert({
      org_id: orgId.value,
      folder_id: payload.folderId,
      kind: payload.kind,
      title: payload.title,
      url: payload.url,
      description: payload.description ?? null,
      sort_order: payload.sortOrder ?? 0,
    }).select('id, org_id, folder_id, kind, title, url, description, override_targets, sort_order, created_at').single()
    return data ?? null
  }

  async function updateResource(id: string, patch: Partial<Pick<ResourceItem, 'title' | 'url' | 'description' | 'kind'>>) {
    await (db.from as any)('resources').update(patch).eq('id', id)
  }

  async function moveResource(id: string, folderId: string | null) {
    await (db.from as any)('resources').update({ folder_id: folderId }).eq('id', id)
  }

  async function deleteResource(id: string) {
    await (db.from as any)('resource_targets').delete().eq('owner_type', 'resource').eq('owner_id', id)
    await (db.from as any)('resources').delete().eq('id', id)
  }

  async function reorderResources(ids: string[]) {
    await Promise.all(ids.map((id, i) =>
      (db.from as any)('resources').update({ sort_order: i }).eq('id', id)))
  }

  async function setOverride(ownerType: 'folder' | 'resource', id: string, value: boolean) {
    const table = ownerType === 'folder' ? 'resource_folders' : 'resources'
    await (db.from as any)(table).update({ override_targets: value }).eq('id', id)
  }

  // ---- Targets ----
  /** All target rows for the org, bucketed by `${ownerType}:${ownerId}`. */
  async function loadAllTargets(): Promise<Record<string, ResourceTarget[]>> {
    const { data } = await (db.from as any)('resource_targets')
      .select('owner_type, owner_id, target_type, target_id, sort_order')
      .eq('org_id', orgId.value).order('sort_order')
    const out: Record<string, ResourceTarget[]> = {}
    for (const t of (data ?? [])) {
      const k = ownerKey(t.owner_type, t.owner_id)
      ;(out[k] ??= []).push(t)
    }
    return out
  }

  /** Save one owner's targets — delete-then-insert (mirrors FormConnectionsDialog). */
  async function saveTargets(ownerType: 'folder' | 'resource', ownerId: string, keyed: Record<string, { checked?: boolean }>) {
    const rows = Object.entries(keyed)
      .filter(([k, v]) => v?.checked && k.includes(':'))
      .map(([k], idx) => {
        const [type, id] = k.split(':')
        return { org_id: orgId.value, owner_type: ownerType, owner_id: ownerId, target_type: type, target_id: id, sort_order: idx }
      })
    await (db.from as any)('resource_targets').delete().eq('owner_type', ownerType).eq('owner_id', ownerId)
    if (rows.length) await (db.from as any)('resource_targets').insert(rows)
    return rows.length
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
    kindFromFilename, kindIcon, kindLabel,
  }
}
