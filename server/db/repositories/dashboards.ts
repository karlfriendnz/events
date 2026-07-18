// The repository: the ONLY code that knows how per-user dashboard layouts are
// stored (user_dashboards, migration 163). Nitro routes call these; they never
// touch Drizzle or the DB directly. When the backend team's MySQL API replaces
// this, only this file changes.
//
// Scope: the per-USER row only. Dashboard TEMPLATES (dashboard_templates) are read
// via the admin domain (useAdminApi.dashboardTemplates) — not owned here.
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type { UserDashboard } from '../../../shared/contracts/dashboard'

// config is a json column — the driver may hand back a parsed array or a JSON
// string. Normalise to an array, or null when never customised.
function asConfig(v: unknown): any[] | null {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

/** One user's saved dashboard layout for an org, or null when they've never saved. */
export async function getUserDashboard(userId: string, orgId: string): Promise<UserDashboard | null> {
  if (!userId || !orgId) return null
  const [r] = await db
    .select()
    .from(schema.userDashboards)
    .where(and(eq(schema.userDashboards.userId, userId), eq(schema.userDashboards.orgId, orgId)))
    .limit(1)
  if (!r) return null
  return { userId: r.userId, orgId: r.orgId, config: asConfig(r.config) }
}

/** Upsert a user's dashboard layout (whole-array replace, keyed on user+org).
 *  Manual check-then-write (rather than ON DUPLICATE KEY) to match the codebase's
 *  conservative repo style. json takes the RAW JS value — never JSON.stringify. */
export async function saveUserDashboard(userId: string, orgId: string, config: any[]): Promise<UserDashboard> {
  const where = and(eq(schema.userDashboards.userId, userId), eq(schema.userDashboards.orgId, orgId))
  const [existing] = await db.select({ userId: schema.userDashboards.userId }).from(schema.userDashboards).where(where).limit(1)
  if (existing) {
    await db.update(schema.userDashboards).set({ config, updatedAt: new Date() } as any).where(where)
  } else {
    // `as any`: schema over-requires notNull columns without defaults; the DB fills
    // updated_at's default when omitted.
    await db.insert(schema.userDashboards).values({ userId, orgId, config, updatedAt: new Date() } as any)
  }
  return (await getUserDashboard(userId, orgId))!
}
