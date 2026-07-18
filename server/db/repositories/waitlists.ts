// The repository: the ONLY code that knows how waitlists, communications, email
// templates and calendars are stored. It turns DB rows into domain objects (the
// contract shape) and back. Nitro routes call these functions; they never touch
// Drizzle or the DB directly. When the backend team's MySQL API replaces this, only
// this file changes — routes, composables and UI are untouched.
//
// json handling: a topic's `channels` and a calendar's `settings` are `json`
// columns. mysql2 usually hands them back already parsed, but a driver/config can
// return the raw string — `asArray` / `asJson` normalise either (and never throw),
// so the domain always sees a real JS value. Timestamps → ISO via `asIso`; the
// driver may return 1/0 for booleans, so `asBool` coerces.
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Waitlist,
  WaitlistEntry,
  Communication,
  CommunicationTopic,
  EmailTemplate,
  Calendar,
  CalendarCreate,
  CalendarPatch,
  WaitlistCreate,
  WaitlistPatch,
} from '../../../shared/contracts/waitlist'

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

// Coerce a json column into its parsed value, leaving non-string payloads as-is.
function asJson(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  return v ?? null
}

// Coerce a TINYINT/boolean column into a real boolean: the driver may return 1/0.
function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1'
}

// Normalise a nullable timestamp column (Date | string | null) into ISO 8601, or
// null when genuinely absent.
function asIso(v: unknown): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v as any)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toWaitlist(r: typeof schema.waitlists.$inferSelect): Waitlist {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    termId: r.termId ?? null,
    orderMode: r.orderMode,
    lineageId: r.lineageId ?? null,
  }
}

function toEntry(r: typeof schema.waitlistEntries.$inferSelect): WaitlistEntry {
  return {
    id: r.id,
    orgId: r.orgId,
    waitlistId: r.waitlistId,
    personId: r.personId,
    status: r.status,
    priority: r.priority,
    sortOrder: r.sortOrder,
    createdAt: asIso(r.createdAt),
  }
}

function toTopic(r: typeof schema.communicationTopics.$inferSelect): CommunicationTopic {
  return {
    id: r.id,
    orgId: r.orgId ?? null,
    name: r.name,
    channels: asArray(r.channels),
  }
}

function toEmailTemplate(r: typeof schema.emailTemplates.$inferSelect): EmailTemplate {
  return {
    id: r.id,
    orgId: r.orgId,
    key: r.key,
    subject: r.subject,
    body: r.body,
  }
}

// `categoryIds` is hydrated separately (from the calendar_categories join) and passed
// in — the base column mapper defaults it to [].
function toCalendar(r: typeof schema.calendars.$inferSelect, categoryIds: string[] = []): Calendar {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    color: r.color ?? null,
    icon: r.icon ?? null,
    pinToNav: asBool(r.pinToNav),
    settings: asJson(r.settings),
    categoryIds,
  }
}

/** Every waitlist an org has, oldest first. */
export async function listWaitlists(orgId: string): Promise<Waitlist[]> {
  const rows = await db
    .select()
    .from(schema.waitlists)
    .where(eq(schema.waitlists.orgId, orgId))
    .orderBy(asc(schema.waitlists.createdAt))
  return rows.map(toWaitlist)
}

/** One waitlist by id, or null. */
export async function getWaitlist(id: string): Promise<Waitlist | null> {
  const [r] = await db.select().from(schema.waitlists).where(eq(schema.waitlists.id, id)).limit(1)
  return r ? toWaitlist(r) : null
}

// ── Writes ── (the waitlist itself)
// The repo owns the id (MySQL can't default a uuid). No json columns here. `as any`
// mirrors the app's insert idiom (the first-pass schema over-requires notNull
// columns the DB defaults, e.g. order_mode).
export async function createWaitlist(input: WaitlistCreate): Promise<Waitlist> {
  const id = randomUUID()
  await db.insert(schema.waitlists).values({
    id,
    orgId: input.orgId,
    name: input.name,
    orderMode: input.orderMode ?? 'custom',
    termId: input.termId ?? null,
    lineageId: input.lineageId ?? null,
  } as any)
  return (await getWaitlist(id))!
}

export async function updateWaitlist(id: string, patch: WaitlistPatch): Promise<Waitlist | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.orderMode !== undefined) set.orderMode = patch.orderMode
  if (patch.termId !== undefined) set.termId = patch.termId
  if (patch.lineageId !== undefined) set.lineageId = patch.lineageId
  if (Object.keys(set).length) await db.update(schema.waitlists).set(set).where(eq(schema.waitlists.id, id))
  return getWaitlist(id)
}

export async function deleteWaitlist(id: string): Promise<void> {
  await db.delete(schema.waitlists).where(eq(schema.waitlists.id, id))
}

/** The people waiting in one queue, in position order. */
export async function listEntries(waitlistId: string): Promise<WaitlistEntry[]> {
  const rows = await db
    .select()
    .from(schema.waitlistEntries)
    .where(eq(schema.waitlistEntries.waitlistId, waitlistId))
    .orderBy(asc(schema.waitlistEntries.sortOrder))
  return rows.map(toEntry)
}

/** Communications for an org, newest first. `communications` is keyed by event and
 *  has no org/status column, so org is resolved through the event (join) and status
 *  is derived — a sent row is 'SENT'. */
export async function listCommunications(orgId: string): Promise<Communication[]> {
  const rows = await db
    .select({ c: schema.communications, orgId: schema.events.orgId })
    .from(schema.communications)
    .innerJoin(schema.events, eq(schema.communications.eventId, schema.events.id))
    .where(eq(schema.events.orgId, orgId))
    .orderBy(asc(schema.communications.sentAt))
  return rows.map((r) => ({
    id: r.c.id,
    orgId: r.orgId,
    subject: r.c.subject,
    body: r.c.body,
    status: 'SENT',
    recipientCount: r.c.recipientCount,
    createdAt: asIso(r.c.sentAt),
  }))
}

/** The comms topics an org offers, in sort order. */
export async function listCommunicationTopics(orgId: string): Promise<CommunicationTopic[]> {
  const rows = await db
    .select()
    .from(schema.communicationTopics)
    .where(eq(schema.communicationTopics.orgId, orgId))
    .orderBy(asc(schema.communicationTopics.sortOrder))
  return rows.map(toTopic)
}

/** The ACTIVE comms topics a form/preview should offer: the platform CORE topics
 *  (org_id null, is_core) then this org's own, each block in sort order, dropping any
 *  inactive topic. Core topics never carry an orgId, so the two blocks never overlap. */
export async function listActiveCommunicationTopics(orgId: string): Promise<CommunicationTopic[]> {
  const [core, own] = await Promise.all([
    db
      .select()
      .from(schema.communicationTopics)
      .where(eq(schema.communicationTopics.isCore, true))
      .orderBy(asc(schema.communicationTopics.sortOrder)),
    db
      .select()
      .from(schema.communicationTopics)
      .where(eq(schema.communicationTopics.orgId, orgId))
      .orderBy(asc(schema.communicationTopics.sortOrder)),
  ])
  return [...core, ...own].filter((t) => asBool(t.isActive)).map(toTopic)
}

/** The club's email templates. */
export async function listEmailTemplates(orgId: string): Promise<EmailTemplate[]> {
  const rows = await db
    .select()
    .from(schema.emailTemplates)
    .where(eq(schema.emailTemplates.orgId, orgId))
    .orderBy(asc(schema.emailTemplates.key))
  return rows.map(toEmailTemplate)
}

// Read all the calendar_categories links for a set of calendar ids, grouped by
// calendar. One query for the whole org's calendars (avoids an N+1 per calendar).
async function categoryIdsByCalendar(calendarIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (calendarIds.length === 0) return map
  const links = await db
    .select()
    .from(schema.calendarCategories)
    .where(inArray(schema.calendarCategories.calendarId, calendarIds))
  for (const l of links) {
    const list = map.get(l.calendarId) ?? []
    list.push(l.categoryId)
    map.set(l.calendarId, list)
  }
  return map
}

/** The club's named calendars, in sort order, each with its linked category ids. */
export async function listCalendars(orgId: string): Promise<Calendar[]> {
  const rows = await db
    .select()
    .from(schema.calendars)
    .where(eq(schema.calendars.orgId, orgId))
    .orderBy(asc(schema.calendars.sortOrder))
  const links = await categoryIdsByCalendar(rows.map((r) => r.id))
  return rows.map((r) => toCalendar(r, links.get(r.id) ?? []))
}

/** One calendar by id (with its category ids), or null. */
export async function getCalendar(id: string): Promise<Calendar | null> {
  const [r] = await db.select().from(schema.calendars).where(eq(schema.calendars.id, id)).limit(1)
  if (!r) return null
  const links = await categoryIdsByCalendar([id])
  return toCalendar(r, links.get(id) ?? [])
}

// ── Calendar writes ──
// The repo owns the id (MySQL can't default a uuid). sort_order + pin_to_nav are
// notNull with no DB default, so they're always written; settings is a json column —
// RAW value, never JSON.stringify (Drizzle double-encodes). categoryIds, when given,
// seeds the join in the same call.
export async function createCalendar(input: CalendarCreate): Promise<Calendar> {
  const id = randomUUID()
  // Append after the org's existing calendars.
  const existing = await db
    .select({ id: schema.calendars.id })
    .from(schema.calendars)
    .where(eq(schema.calendars.orgId, input.orgId))
  await db.insert(schema.calendars).values({
    id,
    orgId: input.orgId,
    name: input.name,
    sortOrder: existing.length,
    pinToNav: input.pinToNav ?? false,
    icon: input.icon ?? null,
    color: input.color ?? null,
    settings: input.settings ?? null,
  } as any)
  if (input.categoryIds && input.categoryIds.length) {
    await setCalendarCategories(input.orgId, id, input.categoryIds)
  }
  return (await getCalendar(id))!
}

export async function updateCalendar(id: string, patch: CalendarPatch): Promise<Calendar | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.color !== undefined) set.color = patch.color
  if (patch.icon !== undefined) set.icon = patch.icon
  if (patch.pinToNav !== undefined) set.pinToNav = patch.pinToNav
  if (patch.settings !== undefined) set.settings = patch.settings
  if (Object.keys(set).length) await db.update(schema.calendars).set(set).where(eq(schema.calendars.id, id))
  return getCalendar(id)
}

// Org-scoped delete (the join rows have no org_id — cascade is by calendar_id).
export async function deleteCalendar(orgId: string, id: string): Promise<void> {
  await db.delete(schema.calendarCategories).where(eq(schema.calendarCategories.calendarId, id))
  await db
    .delete(schema.calendars)
    .where(and(eq(schema.calendars.id, id), eq(schema.calendars.orgId, orgId)))
}

// Replace the set of categories a calendar shows (delete-then-insert the join). The
// calendar is verified to belong to orgId first (tenant safety) — a mismatch is a
// no-op returning []. Returns the calendar's new category ids.
export async function setCalendarCategories(
  orgId: string,
  calendarId: string,
  categoryIds: string[],
): Promise<string[]> {
  const [cal] = await db
    .select({ id: schema.calendars.id })
    .from(schema.calendars)
    .where(and(eq(schema.calendars.id, calendarId), eq(schema.calendars.orgId, orgId)))
    .limit(1)
  if (!cal) return []
  await db.delete(schema.calendarCategories).where(eq(schema.calendarCategories.calendarId, calendarId))
  for (const categoryId of categoryIds) {
    await db.insert(schema.calendarCategories).values({ calendarId, categoryId } as any)
  }
  return categoryIds
}
