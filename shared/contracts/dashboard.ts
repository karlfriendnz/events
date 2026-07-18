// The CONTRACT for a per-user dashboard layout (user_dashboards, migration 163):
// one saved widget layout per (user, org). The layout array shape is open (the
// dashboard page owns the CfgItem structure — key/enabled/x/y/w/h/opts), so the
// seam carries it as passthrough json and doesn't police the widget vocabulary.
//
// Lives in shared/ so client + server import the same definition. NB dashboard
// TEMPLATES (dashboard_templates) are read via the admin domain (useAdminApi);
// this file owns only the per-USER row.
import { z } from 'zod'

export const userDashboardSchema = z.object({
  userId: z.string(),
  orgId: z.string(),
  // The ordered widget layout — an open array (CfgItem[] on the page). null when the
  // user has never customised (they fall back to a template / club default).
  config: z.array(z.any()).nullable(),
})
export type UserDashboard = z.infer<typeof userDashboardSchema>

// The write contract for saving a user's layout — the whole array replaces the row
// (an upsert on the (user, org) primary key).
export const userDashboardSaveSchema = z.object({
  userId: z.string().min(1),
  orgId: z.string().min(1),
  config: z.array(z.any()),
})
export type UserDashboardSave = z.infer<typeof userDashboardSaveSchema>
