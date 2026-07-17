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
import { asc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Waitlist,
  WaitlistEntry,
  Communication,
  CommunicationTopic,
  EmailTemplate,
  Calendar,
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

function toCalendar(r: typeof schema.calendars.$inferSelect): Calendar {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    color: r.color ?? null,
    icon: r.icon ?? null,
    pinToNav: asBool(r.pinToNav),
    settings: asJson(r.settings),
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

/** The club's email templates. */
export async function listEmailTemplates(orgId: string): Promise<EmailTemplate[]> {
  const rows = await db
    .select()
    .from(schema.emailTemplates)
    .where(eq(schema.emailTemplates.orgId, orgId))
    .orderBy(asc(schema.emailTemplates.key))
  return rows.map(toEmailTemplate)
}

/** The club's named calendars, in sort order. */
export async function listCalendars(orgId: string): Promise<Calendar[]> {
  const rows = await db
    .select()
    .from(schema.calendars)
    .where(eq(schema.calendars.orgId, orgId))
    .orderBy(asc(schema.calendars.sortOrder))
  return rows.map(toCalendar)
}
