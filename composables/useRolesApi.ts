// The client side of the seam for roles & permissions. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came from
// MySQL today or the backend team's API tomorrow.
import type { ScopedRoleDef, PermissionGroup, CodeStaff } from '../shared/contracts/role'

export function useRolesApi() {
  /** The org's scoped-role catalogue (per-resource roles for groups / events). */
  async function scopedRoles(orgId: string): Promise<ScopedRoleDef[]> {
    return await $fetch<ScopedRoleDef[]>('/api/v1/scoped-roles', { query: { orgId } })
  }
  /** The org's permission groups PLUS the core templates it inherits. */
  async function permissionGroups(orgId: string): Promise<PermissionGroup[]> {
    return await $fetch<PermissionGroup[]>('/api/v1/permission-groups', { query: { orgId } })
  }
  /** Code-level staff assignments for the org. */
  async function codeStaff(orgId: string): Promise<CodeStaff[]> {
    return await $fetch<CodeStaff[]>('/api/v1/code-staff', { query: { orgId } })
  }
  return { scopedRoles, permissionGroups, codeStaff }
}
