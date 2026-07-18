// A focused contract for the organisation columns the DASHBOARD + PROFILE screens
// read — the club name/logo, the dashboard hero banner + club-default dashboard
// config, the org level, and the club-default profile-dashboard layout. Kept off
// the base Organisation contract (identity/tree only) and off orgSettings (the
// People directory's slice), so each screen's read stays narrow.
//
// Lives in shared/ so client + server import the same definition.
import { z } from 'zod'

export const orgDashboardMetaSchema = z.object({
  name: z.string(),
  logoUrl: z.string().nullable(),
  // The dashboard hero background image.
  dashboardBannerUrl: z.string().nullable(),
  // The club-default dashboard layout (final fallback below user + role templates).
  // Open json — the page owns the CfgItem shape.
  dashboardConfig: z.any().nullable(),
  orgLevel: z.string(),
  // The club-default member-profile dashboard layout (migration 162). Open json.
  profileDashboard: z.any().nullable(),
})
export type OrgDashboardMeta = z.infer<typeof orgDashboardMetaSchema>

// The write contract for the hero banner (set a URL, or null to clear it).
export const dashboardBannerPatchSchema = z.object({
  dashboardBannerUrl: z.string().nullable(),
})
export type DashboardBannerPatch = z.infer<typeof dashboardBannerPatchSchema>
