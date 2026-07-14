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

  // ---- Engagement (migration 260) ----
  //
  // An "open rate" is only meaningful against a denominator, so this section does two
  // things: log what happened (resource_views), and resolve WHO a resource was aimed at
  // (its effective targets → groups / person types → distinct people). A resource with
  // no targets is aimed at everyone, so its denominator is the whole club.

  /** The signed-in user's persons row, resolved once per session (views are per-person). */
  const myPersonId = useState<string | null>('resource_view_person', () => null)
  const myPersonResolved = useState<boolean>('resource_view_person_resolved', () => false)
  async function resolveMyPersonId(): Promise<string | null> {
    if (myPersonResolved.value) return myPersonId.value
    myPersonResolved.value = true
    const user = useSupabaseUser().value
    if (!user?.email) return null
    const { data } = await (db.from as any)('persons')
      .select('id').eq('org_id', orgId.value).eq('email', user.email).maybeSingle()
    myPersonId.value = data?.id ?? null
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
      await (db.from as any)('resource_views').insert({
        org_id: orgId.value,
        resource_id: resourceId,
        person_id: await resolveMyPersonId(),
        user_id: user?.id ?? null,
        kind,
        seconds: opts.seconds ?? null,
        source: opts.source ?? 'library',
      })
    } catch { /* engagement logging is never worth breaking a click over */ }
  }

  /** Every view row for the org, folded into per-resource stats. */
  async function loadViewStats(): Promise<Record<string, ResourceStats>> {
    const { data } = await (db.from as any)('resource_views')
      .select('resource_id, person_id, kind, seconds, created_at')
      .eq('org_id', orgId.value)
    const out: Record<string, ResourceStats & { _viewers: Set<string> }> = {}
    for (const v of (data ?? []) as any[]) {
      const s = (out[v.resource_id] ??= { opens: 0, downloads: 0, watchSeconds: 0, viewerIds: [], lastAt: null, _viewers: new Set() })
      if (v.kind === 'download') s.downloads++
      else if (v.kind === 'watch') s.watchSeconds += v.seconds ?? 0
      else s.opens++
      if (v.person_id) s._viewers.add(v.person_id)
      if (!s.lastAt || v.created_at > s.lastAt) s.lastAt = v.created_at
    }
    const stats: Record<string, ResourceStats> = {}
    for (const [id, s] of Object.entries(out)) {
      stats[id] = { opens: s.opens, downloads: s.downloads, watchSeconds: s.watchSeconds, viewerIds: [...s._viewers], lastAt: s.lastAt }
    }
    return stats
  }

  /** One wave of queries; enough to size any resource's audience client-side. */
  async function loadAudienceIndex(): Promise<AudienceIndex> {
    const [people, types, memberships] = await Promise.all([
      (db.from as any)('persons').select('id, person_types').eq('org_id', orgId.value),
      (db.from as any)('person_target_types').select('id, key').eq('org_id', orgId.value),
      (db.from as any)('member_group_memberships').select('group_id, person_id'),
    ])
    const rows = (people.data ?? []) as { id: string; person_types: string[] | null }[]
    const byType: Record<string, string[]> = {}
    for (const t of ((types.data ?? []) as { id: string; key: string }[])) {
      // resource_targets stores the TYPE's id; a person carries type KEYS.
      byType[t.id] = rows.filter(p => (p.person_types ?? []).includes(t.key)).map(p => p.id)
    }
    const inOrg = new Set(rows.map(p => p.id))
    const byGroup: Record<string, string[]> = {}
    for (const m of ((memberships.data ?? []) as { group_id: string; person_id: string }[])) {
      if (!inOrg.has(m.person_id)) continue   // membership rows carry no org_id — scope via people
      ;(byGroup[m.group_id] ??= []).push(m.person_id)
    }
    return { byType, byGroup, everyone: rows.map(p => p.id) }
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
