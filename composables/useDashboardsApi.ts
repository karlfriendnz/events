// The client side of the seam for per-user dashboard layouts (user_dashboards).
// Components call this — never useDb(), never Supabase, never $fetch to a raw table.
//
// Scope: the per-USER row only. Dashboard TEMPLATES (dashboard_templates) are read
// via useAdminApi().dashboardTemplates — not exposed here.
import type { UserDashboard } from '../shared/contracts/dashboard'

export function useDashboardsApi() {
  /** One user's saved dashboard layout for an org (config is null when never saved). */
  async function userDashboard(userId: string, orgId: string): Promise<UserDashboard> {
    return await $fetch<UserDashboard>('/api/v1/dashboards/user', { query: { userId, orgId } })
  }
  /** Upsert a user's dashboard layout; returns the saved row. */
  async function saveUserDashboard(userId: string, orgId: string, config: any[]): Promise<UserDashboard> {
    return await $fetch<UserDashboard>('/api/v1/dashboards/user', { method: 'POST', body: { userId, orgId, config } })
  }
  return { userDashboard, saveUserDashboard }
}
