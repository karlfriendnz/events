// The client side of the seam for the resources library. Components call this —
// never useDb(), never Supabase, never $fetch to a raw table. It returns
// fully-typed domain objects (the shared contract), so a component has no idea
// whether the data came from MySQL today or the backend team's API tomorrow.
//
// This is the template every migrated screen follows: a use<Thing>Api() composable
// wrapping typed $fetch to /api/v1/*.
import type {
  Resource,
  ResourceFolder,
  ResourceTarget,
  ResourceView,
  ResourceCreate,
  ResourcePatch,
  ResourceFolderCreate,
  ResourceFolderPatch,
  ResourceViewCreate,
} from '../shared/contracts/resource'

export function useResourcesApi() {
  // ── Folders ──
  /** Every folder in an org's resource library. */
  async function folders(orgId: string): Promise<ResourceFolder[]> {
    return await $fetch<ResourceFolder[]>('/api/v1/resource-folders', { query: { orgId } })
  }
  async function createFolder(input: ResourceFolderCreate): Promise<ResourceFolder> {
    return await $fetch<ResourceFolder>('/api/v1/resource-folders', { method: 'POST', body: input })
  }
  async function updateFolder(id: string, patch: ResourceFolderPatch): Promise<ResourceFolder> {
    return await $fetch<ResourceFolder>(`/api/v1/resource-folders/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeFolder(id: string): Promise<void> {
    await $fetch(`/api/v1/resource-folders/${id}`, { method: 'DELETE' })
  }
  /** Bulk reorder folders by an ordered id list. */
  async function reorderFolders(orgId: string, ids: string[]): Promise<void> {
    await $fetch('/api/v1/resource-folders/reorder', { method: 'POST', body: { orgId, ids } })
  }

  // ── Resources ──
  /** Every resource in an org's library. */
  async function resources(orgId: string): Promise<Resource[]> {
    return await $fetch<Resource[]>('/api/v1/resources', { query: { orgId } })
  }
  async function create(input: ResourceCreate): Promise<Resource> {
    return await $fetch<Resource>('/api/v1/resources', { method: 'POST', body: input })
  }
  async function update(id: string, patch: ResourcePatch): Promise<Resource> {
    return await $fetch<Resource>(`/api/v1/resources/${id}`, { method: 'PATCH', body: patch })
  }
  async function remove(id: string): Promise<void> {
    await $fetch(`/api/v1/resources/${id}`, { method: 'DELETE' })
  }
  /** Bulk reorder resources by an ordered id list. */
  async function reorderResources(orgId: string, ids: string[]): Promise<void> {
    await $fetch('/api/v1/resources/reorder', { method: 'POST', body: { orgId, ids } })
  }

  // ── Targets ──
  /** The audience targets for one owner — a folder or a resource. */
  async function targets(ownerType: string, ownerId: string): Promise<ResourceTarget[]> {
    return await $fetch<ResourceTarget[]>('/api/v1/resource-targets', {
      query: { ownerType, ownerId },
    })
  }
  /** Every audience row in the org (the admin explorer buckets them by owner). */
  async function allTargets(orgId: string): Promise<ResourceTarget[]> {
    return await $fetch<ResourceTarget[]>('/api/v1/resource-targets', { query: { orgId } })
  }
  /** Replace one owner's whole audience (delete-then-insert). Returns rows written. */
  async function saveTargets(
    orgId: string,
    ownerType: string,
    ownerId: string,
    tgts: { targetType: string; targetId: string }[],
  ): Promise<number> {
    const res = await $fetch<{ count: number }>('/api/v1/resource-targets/save', {
      method: 'POST',
      body: { orgId, ownerType, ownerId, targets: tgts },
    })
    return res.count
  }

  // ── Views (engagement) ──
  /** Engagement rows for one resource — opens / downloads / watches. */
  async function views(resourceId: string): Promise<ResourceView[]> {
    return await $fetch<ResourceView[]>('/api/v1/resource-views', { query: { resourceId } })
  }
  /** Every view row in the org (folded into per-resource stats client-side). */
  async function viewsByOrg(orgId: string): Promise<ResourceView[]> {
    return await $fetch<ResourceView[]>('/api/v1/resource-views', { query: { orgId } })
  }
  /** Log one interaction. */
  async function logView(input: ResourceViewCreate): Promise<ResourceView> {
    return await $fetch<ResourceView>('/api/v1/resource-views', { method: 'POST', body: input })
  }

  return {
    folders, createFolder, updateFolder, removeFolder, reorderFolders,
    resources, create, update, remove, reorderResources,
    targets, allTargets, saveTargets,
    views, viewsByOrg, logView,
  }
}
