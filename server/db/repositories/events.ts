// The repository: the ONLY code that knows how events (and their sessions,
// invitees, registrations) are stored. It turns DB rows into domain objects (the
// contract shape) and back. Nitro routes call these functions; they never touch
// Drizzle or the DB directly. When the backend team's MySQL API replaces this, only
// this file changes — routes, composables and UI are untouched.
//
// json handling: exdates / roles / addons / form_answers are `json` columns. mysql2
// usually hands them back already parsed, but a driver/config can return the raw
// string — `asArray` / `asObj` normalise either (and never throw), so the domain
// always sees a real JS array / object.
//
// timestamps: MySQL returns Date objects; `toIso` serialises to ISO 8601 and lets
// null pass through, so a nullable start/end date stays null in the contract.
import { asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  FMEvent,
  Session,
  Invitee,
  Registration,
} from '../../../shared/contracts/event'

// Coerce a json column into an array: already an array → use it; a string → parse;
// anything else / a parse failure → [].
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

// Coerce a json column into its parsed value, leaving non-string payloads as-is.
function asObj(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  return v ?? null
}

// Serialise a timestamp to ISO 8601; null/undefined pass through as null.
function toIso(v: unknown): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v as any)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function toEvent(r: typeof schema.events.$inferSelect): FMEvent {
  return {
    id: r.id,
    orgId: r.orgId,
    title: r.title,
    description: r.description ?? null,
    style: r.style,
    status: r.status,
    startAt: toIso(r.startAt),
    endAt: toIso(r.endAt),
    isPublic: r.isPublic,
    isProgramme: r.isProgramme,
    formId: r.formId ?? null,
    memberGroupId: r.memberGroupId ?? null,
    categoryId: r.categoryId ?? null,
    bannerUrl: r.bannerUrl ?? null,
    ageMin: r.ageMin ?? null,
    ageMax: r.ageMax ?? null,
    recurrenceRule: r.recurrenceRule ?? null,
    recurrenceParentId: r.recurrenceParentId ?? null,
    createdVia: r.createdVia ?? null,
    exdates: asArray(r.exdates),
  }
}

function toSession(r: typeof schema.sessions.$inferSelect): Session {
  return {
    id: r.id,
    eventId: r.eventId,
    startAt: toIso(r.startAt),
    endAt: toIso(r.endAt),
    // No `status` column on sessions — exposed for contract stability, always null.
    status: null,
    capacityMax: r.capacityMax ?? null,
    locationType: r.locationType,
    address: r.address ?? null,
    meetingLink: r.meetingLink ?? null,
    isMaster: r.isMaster,
    masterId: r.masterId ?? null,
    addons: asArray(r.addons),
  }
}

function toInvitee(r: typeof schema.invitees.$inferSelect): Invitee {
  return {
    id: r.id,
    eventId: r.eventId,
    personId: r.personId ?? null,
    status: r.status,
    roles: asArray(r.roles).map(String),
    attended: r.attended,
    respondedAt: toIso(r.respondedAt),
  }
}

function toRegistration(r: typeof schema.registrations.$inferSelect): Registration {
  return {
    id: r.id,
    eventId: r.eventId,
    personId: r.personId ?? null,
    status: r.status,
    totalAmount: r.totalAmount,
    paidAmount: r.paidAmount,
    formAnswers: asObj(r.formAnswers),
    checkedInAt: toIso(r.checkedInAt),
  }
}

/** Every event for an org, newest first. Optional limit/offset for paging. */
export async function listEvents(
  orgId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<FMEvent[]> {
  const q = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.orgId, orgId))
    .orderBy(desc(schema.events.createdAt))
  if (opts.limit != null) q.limit(opts.limit)
  if (opts.offset != null) q.offset(opts.offset)
  const rows = await q
  return rows.map(toEvent)
}

/** One event by id, or null. */
export async function getEvent(id: string): Promise<FMEvent | null> {
  const [r] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1)
  return r ? toEvent(r) : null
}

/** The sessions of an event, in author order. */
export async function listSessions(eventId: string): Promise<Session[]> {
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.eventId, eventId))
    .orderBy(asc(schema.sessions.sortOrder))
  return rows.map(toSession)
}

/** The invitees of an event, oldest invite first. */
export async function listInvitees(eventId: string): Promise<Invitee[]> {
  const rows = await db
    .select()
    .from(schema.invitees)
    .where(eq(schema.invitees.eventId, eventId))
    .orderBy(asc(schema.invitees.invitedAt))
  return rows.map(toInvitee)
}

/** The registrations of an event, newest first. */
export async function listRegistrations(eventId: string): Promise<Registration[]> {
  const rows = await db
    .select()
    .from(schema.registrations)
    .where(eq(schema.registrations.eventId, eventId))
    .orderBy(desc(schema.registrations.createdAt))
  return rows.map(toRegistration)
}
