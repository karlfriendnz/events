// The client side of the seam for roles & permissions. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came from
// MySQL today or the backend team's API tomorrow.
import type {
  ScopedRoleDef,
  ScopedRoleDefCreate,
  ScopedRoleDefPatch,
  PermissionGroup,
  CodeStaff,
} from '../shared/contracts/role'

export function useRolesApi() {
  /** The org's scoped-role catalogue (per-resource roles for groups / events). */
  async function scopedRoles(orgId: string): Promise<ScopedRoleDef[]> {
    return await $fetch<ScopedRoleDef[]>('/api/v1/scoped-roles', { query: { orgId } })
  }
  async function createScopedRole(input: ScopedRoleDefCreate): Promise<ScopedRoleDef> {
    return await $fetch<ScopedRoleDef>('/api/v1/scoped-roles', { method: 'POST', body: input })
  }
  async function updateScopedRole(id: string, patch: ScopedRoleDefPatch): Promise<ScopedRoleDef> {
    return await $fetch<ScopedRoleDef>(`/api/v1/scoped-roles/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeScopedRole(id: string): Promise<void> {
    await $fetch(`/api/v1/scoped-roles/${id}`, { method: 'DELETE' })
  }
  /** The org's permission groups PLUS the core templates it inherits. */
  async function permissionGroups(orgId: string): Promise<PermissionGroup[]> {
    return await $fetch<PermissionGroup[]>('/api/v1/permission-groups', { query: { orgId } })
  }
  /** Code-level staff assignments for the org. */
  async function codeStaff(orgId: string): Promise<CodeStaff[]> {
    return await $fetch<CodeStaff[]>('/api/v1/code-staff', { query: { orgId } })
  }
  /** The person ids holding a (legacy) permission group in the org — the Admins tab
   *  uses it to flag people with access via the old RBAC path. */
  async function permissionGroupMemberPersonIds(orgId: string): Promise<string[]> {
    return await $fetch<string[]>('/api/v1/permission-group-members', { query: { orgId } })
  }
  return {
    scopedRoles,
    createScopedRole,
    updateScopedRole,
    removeScopedRole,
    permissionGroups,
    codeStaff,
    permissionGroupMemberPersonIds,
  }
}
