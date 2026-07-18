// The CONTRACT for the resources domain: Zod schemas + the domain types inferred
// from them, shared by the client (typed composable) and the server (Nitro route
// output validation). DB-neutral by design — whether a resource library is stored
// in MySQL today, was Postgres before, or lives behind a future API, the UI and
// pure logic only ever see this shape; only the repository mapper knows the storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A folder in the hierarchical resource library. `parentId` null = a root folder.
// `overrideTargets` = this folder carries its own audience instead of inheriting
// its parent's.
export const resourceFolderSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  overrideTargets: z.boolean(),
  sortOrder: z.number().int(),
})
export type ResourceFolder = z.infer<typeof resourceFolderSchema>

export const resourceFolderListSchema = z.array(resourceFolderSchema)

// WRITE contracts for folders. Create omits the server-owned id; only name is
// required, the rest default in the repo (root folder, no override, sort 0). Patch
// is a partial — a rename sends { name }, a move sends { parentId }, an override
// toggle sends { overrideTargets }.
export const resourceFolderCreateSchema = resourceFolderSchema
  .omit({ id: true })
  .partial({ parentId: true, overrideTargets: true, sortOrder: true })
  .extend({ name: z.string().min(1) })
export type ResourceFolderCreate = z.infer<typeof resourceFolderCreateSchema>

export const resourceFolderPatchSchema = resourceFolderCreateSchema.partial()
export type ResourceFolderPatch = z.infer<typeof resourceFolderPatchSchema>

// A resource (file / link / video / image / doc) inside a folder. `kind` and the
// folder link are open strings — validated as a set at the boundary, not a DB CHECK.
export const resourceSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  folderId: z.string().nullable(),
  kind: z.string(),
  title: z.string(),
  url: z.string(),
  description: z.string().nullable(),
  overrideTargets: z.boolean(),
  sortOrder: z.number().int(),
})
export type Resource = z.infer<typeof resourceSchema>

export const resourceListSchema = z.array(resourceSchema)

// WRITE contracts. Create omits the server-owned id; orgId/kind/title/url are
// required, the rest default in the repo. Patch is a partial.
export const resourceCreateSchema = resourceSchema
  .omit({ id: true })
  .partial({ folderId: true, description: true, overrideTargets: true, sortOrder: true })
  .extend({ title: z.string().min(1) })
export type ResourceCreate = z.infer<typeof resourceCreateSchema>

export const resourcePatchSchema = resourceCreateSchema.partial()
export type ResourcePatch = z.infer<typeof resourcePatchSchema>

// A polymorphic audience link: a folder or a resource (`ownerType`/`ownerId`)
// aimed at a group or person-type (`targetType`/`targetId`). All open strings.
export const resourceTargetSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  ownerType: z.string(),
  ownerId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
})
export type ResourceTarget = z.infer<typeof resourceTargetSchema>

export const resourceTargetListSchema = z.array(resourceTargetSchema)

// Saving one owner's whole audience at once — delete-then-insert (mirrors
// FormConnectionsDialog). orgId scopes the write; an empty `targets` clears the
// owner's audience entirely (used when an item stops overriding its folder).
export const resourceTargetsSaveSchema = z.object({
  orgId: z.string(),
  ownerType: z.string(),
  ownerId: z.string(),
  targets: z.array(z.object({ targetType: z.string(), targetId: z.string() })),
})
export type ResourceTargetsSave = z.infer<typeof resourceTargetsSaveSchema>

// A bulk reorder: an ordered id list, org-scoped in the WHERE (never trust the id
// list alone). Each id's new sort_order is its index in the array.
export const resourceReorderSchema = z.object({
  orgId: z.string(),
  ids: z.array(z.string()),
})
export type ResourceReorder = z.infer<typeof resourceReorderSchema>

// One engagement interaction with a resource — an open / download / watch, by a
// person (or anonymous). `seconds` = dwell for a timed watch. `createdAt` is ISO
// 8601 at the boundary; the DB stores a timestamp and the repo serialises it.
export const resourceViewSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  resourceId: z.string(),
  personId: z.string().nullable(),
  userId: z.string().nullable(),
  kind: z.string(),
  seconds: z.number().int().nullable(),
  source: z.string().nullable(),
  createdAt: z.string(),
})
export type ResourceView = z.infer<typeof resourceViewSchema>

export const resourceViewListSchema = z.array(resourceViewSchema)

// Logging one engagement interaction. The server owns id + createdAt; personId /
// userId may be null (an anonymous open), and seconds is only set for a timed watch.
export const resourceViewCreateSchema = resourceViewSchema
  .omit({ id: true, createdAt: true })
  .partial({ personId: true, userId: true, seconds: true, source: true })
export type ResourceViewCreate = z.infer<typeof resourceViewCreateSchema>
