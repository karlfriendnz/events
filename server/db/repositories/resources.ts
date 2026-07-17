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
import { and, asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Resource,
  ResourceFolder,
  ResourceTarget,
  ResourceView,
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
