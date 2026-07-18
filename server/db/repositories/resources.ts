// The repository: the ONLY code that knows how the resources library is stored. It
// turns DB rows into domain objects (the contract shape) and back. Nitro routes
// call these functions; they never touch Drizzle or the DB directly. When the
// backend team's MySQL API replaces this, only this file changes — routes,
// composables and UI are untouched.
//
// json handling: this domain has NO json columns — folders, resources, targets and
// views are all flat scalar rows. The only mappings that need care are booleans
// (`override_targets` — mysql2 can hand a TINYINT back as 0/1, so `asBool`
// normalises to a real boolean) and timestamps (`created_at` on a view →
// ISO 8601 at the boundary).
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Resource,
  ResourceFolder,
  ResourceTarget,
  ResourceView,
  ResourceCreate,
  ResourcePatch,
  ResourceFolderCreate,
  ResourceFolderPatch,
  ResourceTargetsSave,
  ResourceViewCreate,
} from '../../../shared/contracts/resource'

// Coerce a TINYINT/boolean column into a real boolean: the driver may return 1/0.
function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1'
}

// Normalise a timestamp column (Date | string | null) into ISO 8601. A missing
// value (nullable defaultNow rows never realistically hit this) falls back to now.
function asIso(v: unknown): string {
  const d = v instanceof Date ? v : new Date((v as any) ?? Date.now())
  return d.toISOString()
}

function toFolder(r: typeof schema.resourceFolders.$inferSelect): ResourceFolder {
  return {
    id: r.id,
    orgId: r.orgId,
    parentId: r.parentId ?? null,
    name: r.name,
    overrideTargets: asBool(r.overrideTargets),
    sortOrder: r.sortOrder,
  }
}

function toResource(r: typeof schema.resources.$inferSelect): Resource {
  return {
    id: r.id,
    orgId: r.orgId,
    folderId: r.folderId ?? null,
    kind: r.kind,
    title: r.title,
    url: r.url,
    description: r.description ?? null,
    overrideTargets: asBool(r.overrideTargets),
    sortOrder: r.sortOrder,
  }
}

function toTarget(r: typeof schema.resourceTargets.$inferSelect): ResourceTarget {
  return {
    id: r.id,
    orgId: r.orgId,
    ownerType: r.ownerType,
    ownerId: r.ownerId,
    targetType: r.targetType,
    targetId: r.targetId,
  }
}

function toView(r: typeof schema.resourceViews.$inferSelect): ResourceView {
  return {
    id: r.id,
    orgId: r.orgId,
    resourceId: r.resourceId,
    personId: r.personId ?? null,
    userId: r.userId ?? null,
    kind: r.kind,
    seconds: r.seconds ?? null,
    source: r.source ?? null,
    createdAt: asIso(r.createdAt),
  }
}

/** Every folder in an org's resource library, in author order. */
export async function listFolders(orgId: string): Promise<ResourceFolder[]> {
  const rows = await db
    .select()
    .from(schema.resourceFolders)
    .where(eq(schema.resourceFolders.orgId, orgId))
    .orderBy(asc(schema.resourceFolders.sortOrder))
  return rows.map(toFolder)
}

/** Every resource in an org's library, in author order. */
export async function listResources(orgId: string): Promise<Resource[]> {
  const rows = await db
    .select()
    .from(schema.resources)
    .where(eq(schema.resources.orgId, orgId))
    .orderBy(asc(schema.resources.sortOrder))
  return rows.map(toResource)
}

/** The audience targets for one owner — a folder or a resource. */
export async function listTargets(ownerType: string, ownerId: string): Promise<ResourceTarget[]> {
  const rows = await db
    .select()
    .from(schema.resourceTargets)
    .where(
      and(
        eq(schema.resourceTargets.ownerType, ownerType),
        eq(schema.resourceTargets.ownerId, ownerId),
      ),
    )
    .orderBy(asc(schema.resourceTargets.sortOrder))
  return rows.map(toTarget)
}

/** Engagement rows for one resource — one per open/download/watch, newest first. */
export async function listViews(resourceId: string): Promise<ResourceView[]> {
  const rows = await db
    .select()
    .from(schema.resourceViews)
    .where(eq(schema.resourceViews.resourceId, resourceId))
    .orderBy(desc(schema.resourceViews.createdAt))
  return rows.map(toView)
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). This domain has no json columns
// — flat scalar rows. `as any` mirrors the app's insert idiom (the first-pass schema
// over-requires notNull columns the DB defaults, e.g. override_targets / sort_order).
export async function getResource(id: string): Promise<Resource | null> {
  const [r] = await db.select().from(schema.resources).where(eq(schema.resources.id, id)).limit(1)
  return r ? toResource(r) : null
}

export async function createResource(input: ResourceCreate): Promise<Resource> {
  const id = randomUUID()
  await db.insert(schema.resources).values({
    id,
    orgId: input.orgId,
    folderId: input.folderId ?? null,
    kind: input.kind,
    title: input.title,
    url: input.url,
    description: input.description ?? null,
    overrideTargets: input.overrideTargets ?? false,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getResource(id))!
}

export async function updateResource(id: string, patch: ResourcePatch): Promise<Resource | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.folderId !== undefined) set.folderId = patch.folderId
  if (patch.kind !== undefined) set.kind = patch.kind
  if (patch.title !== undefined) set.title = patch.title
  if (patch.url !== undefined) set.url = patch.url
  if (patch.description !== undefined) set.description = patch.description
  if (patch.overrideTargets !== undefined) set.overrideTargets = patch.overrideTargets
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.resources).set(set).where(eq(schema.resources.id, id))
  return getResource(id)
}

export async function deleteResource(id: string): Promise<void> {
  // Clean up this resource's own audience rows first (they carry no FK), then the row.
  await db
    .delete(schema.resourceTargets)
    .where(and(eq(schema.resourceTargets.ownerType, 'resource'), eq(schema.resourceTargets.ownerId, id)))
  await db.delete(schema.resources).where(eq(schema.resources.id, id))
}

/** Reorder resources: each id's new sort_order is its index. Org-scoped WHERE so a
 *  stray id from another org can never be renumbered. */
export async function reorderResources(orgId: string, ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, i) =>
      db
        .update(schema.resources)
        .set({ sortOrder: i })
        .where(and(eq(schema.resources.orgId, orgId), eq(schema.resources.id, id))),
    ),
  )
}

// ── Folders ──
export async function getFolder(id: string): Promise<ResourceFolder | null> {
  const [r] = await db
    .select()
    .from(schema.resourceFolders)
    .where(eq(schema.resourceFolders.id, id))
    .limit(1)
  return r ? toFolder(r) : null
}

export async function createFolder(input: ResourceFolderCreate): Promise<ResourceFolder> {
  const id = randomUUID()
  await db.insert(schema.resourceFolders).values({
    id,
    orgId: input.orgId,
    parentId: input.parentId ?? null,
    name: input.name,
    overrideTargets: input.overrideTargets ?? false,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await getFolder(id))!
}

export async function updateFolder(id: string, patch: ResourceFolderPatch): Promise<ResourceFolder | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.parentId !== undefined) set.parentId = patch.parentId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.overrideTargets !== undefined) set.overrideTargets = patch.overrideTargets
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length)
    await db.update(schema.resourceFolders).set(set).where(eq(schema.resourceFolders.id, id))
  return getFolder(id)
}

export async function deleteFolder(id: string): Promise<void> {
  // Child folders/resources cascade via FK; clean up this folder's own target rows.
  await db
    .delete(schema.resourceTargets)
    .where(and(eq(schema.resourceTargets.ownerType, 'folder'), eq(schema.resourceTargets.ownerId, id)))
  await db.delete(schema.resourceFolders).where(eq(schema.resourceFolders.id, id))
}

/** Reorder folders: each id's new sort_order is its index. Org-scoped WHERE. */
export async function reorderFolders(orgId: string, ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id, i) =>
      db
        .update(schema.resourceFolders)
        .set({ sortOrder: i })
        .where(and(eq(schema.resourceFolders.orgId, orgId), eq(schema.resourceFolders.id, id))),
    ),
  )
}

// ── Targets ──
/** Every audience row for an org, in author order — the caller buckets by owner. */
export async function listTargetsByOrg(orgId: string): Promise<ResourceTarget[]> {
  const rows = await db
    .select()
    .from(schema.resourceTargets)
    .where(eq(schema.resourceTargets.orgId, orgId))
    .orderBy(asc(schema.resourceTargets.sortOrder))
  return rows.map(toTarget)
}

/** Replace one owner's whole audience — delete-then-insert. Returns how many rows
 *  were written. An empty `targets` clears the owner's audience entirely. */
export async function saveTargets(input: ResourceTargetsSave): Promise<number> {
  await db
    .delete(schema.resourceTargets)
    .where(
      and(
        eq(schema.resourceTargets.ownerType, input.ownerType),
        eq(schema.resourceTargets.ownerId, input.ownerId),
      ),
    )
  if (input.targets.length) {
    await db.insert(schema.resourceTargets).values(
      input.targets.map((t, idx) => ({
        id: randomUUID(),
        orgId: input.orgId,
        ownerType: input.ownerType,
        ownerId: input.ownerId,
        targetType: t.targetType,
        targetId: t.targetId,
        sortOrder: idx,
      })) as any,
    )
  }
  return input.targets.length
}

// ── Views (engagement) ──
/** Every view row for an org — the caller folds these into per-resource stats. */
export async function listViewsByOrg(orgId: string): Promise<ResourceView[]> {
  const rows = await db
    .select()
    .from(schema.resourceViews)
    .where(eq(schema.resourceViews.orgId, orgId))
    .orderBy(desc(schema.resourceViews.createdAt))
  return rows.map(toView)
}

/** Log one interaction. The DB fills created_at; personId/userId may be null. */
export async function createView(input: ResourceViewCreate): Promise<ResourceView> {
  const id = randomUUID()
  await db.insert(schema.resourceViews).values({
    id,
    orgId: input.orgId,
    resourceId: input.resourceId,
    personId: input.personId ?? null,
    userId: input.userId ?? null,
    kind: input.kind,
    seconds: input.seconds ?? null,
    source: input.source ?? 'library',
  } as any)
  const [r] = await db.select().from(schema.resourceViews).where(eq(schema.resourceViews.id, id)).limit(1)
  return toView(r)
}
