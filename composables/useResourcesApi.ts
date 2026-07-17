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
} from '../shared/contracts/resource'

export function useResourcesApi() {
  /** Every folder in an org's resource library. */
  async function folders(orgId: string): Promise<ResourceFolder[]> {
    return await $fetch<ResourceFolder[]>('/api/v1/resource-folders', { query: { orgId } })
  }
  /** Every resource in an org's library. */
  async function resources(orgId: string): Promise<Resource[]> {
    return await $fetch<Resource[]>('/api/v1/resources', { query: { orgId } })
  }
  /** The audience targets for one owner — a folder or a resource. */
  async function targets(ownerType: string, ownerId: string): Promise<ResourceTarget[]> {
    return await $fetch<ResourceTarget[]>('/api/v1/resource-targets', {
      query: { ownerType, ownerId },
    })
  }
  /** Engagement rows for one resource — opens / downloads / watches. */
  async function views(resourceId: string): Promise<ResourceView[]> {
    return await $fetch<ResourceView[]>('/api/v1/resource-views', { query: { resourceId } })
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
  return { folders, resources, targets, views, create, update, remove }
}
