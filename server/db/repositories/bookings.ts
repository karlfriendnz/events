// The repository: the ONLY code that knows how bookables, activities, activity
// modes and bookings are stored. It turns DB rows into domain objects (the contract
// shape) and back. Nitro routes call these functions; they never touch Drizzle or
// the DB directly. When the backend team's MySQL API replaces this, only this file
// changes — routes, composables and UI are untouched.
//
// json handling: sections/features/categories/sports (bookables) and a mode's
// pricing/addons are `json` columns. mysql2 usually hands them back already parsed,
// but a driver/config can return the raw string — asArray/asObj normalise either
// (and never throw), so the domain always sees a real JS value.
import { randomUUID } from 'node:crypto'
import { asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Bookable,
  Activity,
  ActivityMode,
  Booking,
  BookableCreate,
  BookablePatch,
  ActivityCreate,
  ActivityPatch,
} from '../../../shared/contracts/booking'

// Coerce a json column into string[]: already an array → use it; a string → parse;
// anything else / a parse failure → [].
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

// Coerce a json column into a plain object (a mode's pricing): already an object →
// use it; a string → parse to an object; anything else / a parse failure → null.
function asObj(v: unknown): Record<string, any> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

// Coerce a json column into an array of arbitrary items (a mode's addons).
function asAnyArray(v: unknown): any[] | null {
  if (Array.isArray(v)) return v as any[]
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

// A DB timestamp → ISO 8601 string, the transport form.
function toIso(v: unknown): string {
  const d = v instanceof Date ? v : new Date(v as any)
  return d.toISOString()
}

function toBookable(r: typeof schema.bookables.$inferSelect): Bookable {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    type: r.type,
    parentId: r.parentId ?? null,
    masterId: r.masterId ?? null,
    maxConcurrent: r.maxConcurrent,
    status: r.status,
    isPublic: r.isPublic,
    sections: asArray(r.sections),
    features: asArray(r.features),
    categories: asArray(r.categories),
    sports: asArray(r.sports),
  }
}

function toActivity(r: typeof schema.activities.$inferSelect): Activity {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    description: r.description ?? null,
    color: r.color,
    icon: r.icon,
    imageUrl: r.imageUrl ?? null,
    status: r.status,
    staffBookableId: r.staffBookableId ?? null,
    bookingFlow: r.bookingFlow,
    assignmentMode: r.assignmentMode,
    bookingsEnabled: r.bookingsEnabled,
  }
}

function toActivityMode(r: typeof schema.activityModes.$inferSelect): ActivityMode {
  return {
    id: r.id,
    activityId: r.activityId,
    name: r.name,
    color: r.color ?? null,
    pricing: asObj(r.pricing),
    addons: asAnyArray(r.addons),
    configurationKey: r.configurationKey ?? null,
    formId: r.formId ?? null,
    sortOrder: r.sortOrder,
    periodUnit: r.periodUnit ?? null,
    periodCount: r.periodCount,
    termType: r.termType,
    periodPrice: r.periodPrice ?? null,
  }
}

// bookings has NO org_id column — orgId is passed in from the joined bookable.
function toBooking(r: typeof schema.bookings.$inferSelect, orgId: string): Booking {
  return {
    id: r.id,
    orgId,
    bookableId: r.bookableId,
    activityId: r.activityId ?? null,
    activityModeId: r.activityModeId ?? null,
    startAt: toIso(r.startAt),
    endAt: toIso(r.endAt),
    status: r.status,
    parentBookingId: r.parentBookingId ?? null,
    isRecurring: r.isRecurring,
    subjectPersonId: r.subjectPersonId ?? null,
    accessCode: r.accessCode ?? null,
  }
}

/** Every bookable an org owns, in sort order. */
export async function listBookables(orgId: string): Promise<Bookable[]> {
  const rows = await db
    .select()
    .from(schema.bookables)
    .where(eq(schema.bookables.orgId, orgId))
    .orderBy(asc(schema.bookables.sortOrder))
  return rows.map(toBookable)
}

/** One bookable by id, or null. */
export async function getBookable(id: string): Promise<Bookable | null> {
  const [r] = await db.select().from(schema.bookables).where(eq(schema.bookables.id, id)).limit(1)
  return r ? toBookable(r) : null
}

// ── Bookable writes ──
// The repo owns the id (MySQL can't default a uuid). The json array columns
// (sections/features/categories/sports) are JSON.stringify'd on the way IN,
// mirroring asArray on the way OUT. `as any` on the insert: the first-pass schema
// marks many columns .notNull() (from Postgres) without their defaults, so Drizzle
// over-requires them; the DB (defaults + relaxed mode) fills the rest. Consistent
// with the app's (db.from as any) idiom.
export async function createBookable(input: BookableCreate): Promise<Bookable> {
  const id = randomUUID()
  await db.insert(schema.bookables).values({
    id,
    orgId: input.orgId,
    name: input.name,
    type: input.type ?? 'VENUE',
    parentId: input.parentId ?? null,
    masterId: input.masterId ?? null,
    maxConcurrent: input.maxConcurrent ?? 1,
    status: input.status ?? 'ACTIVE',
    isPublic: input.isPublic ?? true,
    sections: input.sections ?? [],
    features: input.features ?? [],
    categories: input.categories ?? [],
    sports: input.sports ?? [],
  } as any)
  return (await getBookable(id))!
}

export async function updateBookable(id: string, patch: BookablePatch): Promise<Bookable | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.type !== undefined) set.type = patch.type
  if (patch.parentId !== undefined) set.parentId = patch.parentId
  if (patch.masterId !== undefined) set.masterId = patch.masterId
  if (patch.maxConcurrent !== undefined) set.maxConcurrent = patch.maxConcurrent
  if (patch.status !== undefined) set.status = patch.status
  if (patch.isPublic !== undefined) set.isPublic = patch.isPublic
  if (patch.sections !== undefined) set.sections = patch.sections ?? []
  if (patch.features !== undefined) set.features = patch.features ?? []
  if (patch.categories !== undefined) set.categories = patch.categories ?? []
  if (patch.sports !== undefined) set.sports = patch.sports ?? []
  if (Object.keys(set).length) await db.update(schema.bookables).set(set).where(eq(schema.bookables.id, id))
  return getBookable(id)
}

export async function deleteBookable(id: string): Promise<void> {
  await db.delete(schema.bookables).where(eq(schema.bookables.id, id))
}

/** Every activity an org offers, in sort order. */
export async function listActivities(orgId: string): Promise<Activity[]> {
  const rows = await db
    .select()
    .from(schema.activities)
    .where(eq(schema.activities.orgId, orgId))
    .orderBy(asc(schema.activities.sortOrder))
  return rows.map(toActivity)
}

/** One activity by id, or null. */
export async function getActivity(id: string): Promise<Activity | null> {
  const [r] = await db.select().from(schema.activities).where(eq(schema.activities.id, id)).limit(1)
  return r ? toActivity(r) : null
}

// ── Activity writes ──
// The repo owns the id. activities has no json columns, so nothing to stringify;
// `as any` per the insert idiom above lets the DB fill the .notNull() columns the
// contract doesn't carry (the many booking-behaviour flags).
export async function createActivity(input: ActivityCreate): Promise<Activity> {
  const id = randomUUID()
  await db.insert(schema.activities).values({
    id,
    orgId: input.orgId,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? '#1E2157',
    icon: input.icon ?? 'pi-calendar',
    imageUrl: input.imageUrl ?? null,
    status: input.status ?? 'ACTIVE',
    staffBookableId: input.staffBookableId ?? null,
    bookingFlow: input.bookingFlow ?? 'wizard',
    assignmentMode: input.assignmentMode ?? 'system',
    bookingsEnabled: input.bookingsEnabled ?? true,
  } as any)
  return (await getActivity(id))!
}

export async function updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.description !== undefined) set.description = patch.description
  if (patch.color !== undefined) set.color = patch.color
  if (patch.icon !== undefined) set.icon = patch.icon
  if (patch.imageUrl !== undefined) set.imageUrl = patch.imageUrl
  if (patch.status !== undefined) set.status = patch.status
  if (patch.staffBookableId !== undefined) set.staffBookableId = patch.staffBookableId
  if (patch.bookingFlow !== undefined) set.bookingFlow = patch.bookingFlow
  if (patch.assignmentMode !== undefined) set.assignmentMode = patch.assignmentMode
  if (patch.bookingsEnabled !== undefined) set.bookingsEnabled = patch.bookingsEnabled
  if (Object.keys(set).length) await db.update(schema.activities).set(set).where(eq(schema.activities.id, id))
  return getActivity(id)
}

export async function deleteActivity(id: string): Promise<void> {
  await db.delete(schema.activities).where(eq(schema.activities.id, id))
}

/** The modes of one activity, in sort order. */
export async function listActivityModes(activityId: string): Promise<ActivityMode[]> {
  const rows = await db
    .select()
    .from(schema.activityModes)
    .where(eq(schema.activityModes.activityId, activityId))
    .orderBy(asc(schema.activityModes.sortOrder))
  return rows.map(toActivityMode)
}

/**
 * Bookings for an org, newest first. There is no org_id on bookings, so scope via a
 * JOIN to the bookable (bookings.bookable_id → bookables.org_id) and carry that
 * org_id onto the domain object. `limit`/`offset` page the result.
 */
export async function listBookings(
  orgId: string,
  opts?: { limit?: number; offset?: number },
): Promise<Booking[]> {
  let q = db
    .select({ b: schema.bookings, orgId: schema.bookables.orgId })
    .from(schema.bookings)
    .innerJoin(schema.bookables, eq(schema.bookings.bookableId, schema.bookables.id))
    .where(eq(schema.bookables.orgId, orgId))
    .orderBy(desc(schema.bookings.startAt))
    .$dynamic()
  if (opts?.limit != null) q = q.limit(opts.limit)
  if (opts?.offset != null) q = q.offset(opts.offset)
  const rows = await q
  return rows.map((r) => toBooking(r.b, r.orgId))
}
