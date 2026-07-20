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
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, ne, or } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  FMEvent,
  Session,
  SeparateSession,
  Invitee,
  InviteeWithPerson,
  Registration,
  InviteeForPerson,
  TicketOrder,
  SeriesEvent,
  FMEventCreate,
  FMEventPatch,
  SessionCreate,
  SessionPatch,
  FeeComponent,
  FeeComponentCreate,
  FeeComponentPatch,
  EventNote,
  EventNoteCreate,
  EventNotePatch,
  EventTask,
  EventTaskCreate,
  EventTaskPatch,
  EventCategory,
  EventCategoryCreate,
  EventCategoryPatch,
  TicketType,
  TicketTypeCreate,
  TicketTypePatch,
  RegistrationSession,
  RegistrationCreate,
  RegistrationPatch,
  ConnectionGroup,
  GenerateTrainingInput,
  GenerateTrainingResult,
  EventCommunication,
  EventCommunicationCreate,
  EventOrgInvitee,
  EventOrgInviteeWithName,
  EventConnections,
  EventOrgInviteForClub,
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
    locationType: r.locationType,
    bookableId: r.bookableId ?? null,
    address: r.address ?? null,
    meetingLink: r.meetingLink ?? null,
    locations: asObj(r.locations),
    ageMin: r.ageMin ?? null,
    ageMax: r.ageMax ?? null,
    genderRestriction: r.genderRestriction ?? null,
    recurrenceRule: r.recurrenceRule ?? null,
    recurrenceParentId: r.recurrenceParentId ?? null,
    createdVia: r.createdVia ?? null,
    exdates: asArray(r.exdates),
    isAllDay: r.isAllDay,
    secondaryCategoryId: r.secondaryCategoryId ?? null,
    capacityMin: r.capacityMin ?? null,
    capacityMax: r.capacityMax ?? null,
    showAttendeeList: r.showAttendeeList,
    showAttendeeCount: r.showAttendeeCount,
    allowInterest: r.allowInterest,
    allowGuests: r.allowGuests,
    maxGuestsPerInvitee: r.maxGuestsPerInvitee ?? null,
    holdSpotEnabled: r.holdSpotEnabled,
    holdSpotAgeMax: r.holdSpotAgeMax ?? null,
    phasedRegistration: r.phasedRegistration,
    memberWindowDays: r.memberWindowDays,
    publicOpensAt: toIso(r.publicOpensAt),
    masterEventId: r.masterEventId ?? null,
    isFeatured: r.isFeatured,
    publicUrlSlug: r.publicUrlSlug ?? null,
    tcContent: r.tcContent ?? null,
    hasWaitlist: r.hasWaitlist,
    hasTickets: r.hasTickets,
    regOpenAt: toIso(r.regOpenAt),
    regCloseAt: toIso(r.regCloseAt),
    publishAt: toIso(r.publishAt),
    notes: r.notes ?? null,
    hideBanner: r.hideBanner,
    xeroCodesLocked: r.xeroCodesLocked,
    memberGroupScheduleId: r.memberGroupScheduleId ?? null,
    attachments: asObj(r.attachments),
    subGroups: asObj(r.subGroups),
    sharingConfig: asObj(r.sharingConfig),
    automation: asObj(r.automation),
    invitationEmail: asObj(r.invitationEmail),
  }
}

function toSession(r: typeof schema.sessions.$inferSelect): Session {
  return {
    id: r.id,
    eventId: r.eventId,
    parentSessionId: r.parentSessionId ?? null,
    title: r.title,
    description: r.description ?? null,
    startAt: toIso(r.startAt),
    endAt: toIso(r.endAt),
    // No `status` column on sessions — exposed for contract stability, always null.
    status: null,
    capacityMin: r.capacityMin ?? null,
    capacityMax: r.capacityMax ?? null,
    locationType: r.locationType,
    bookableId: r.bookableId ?? null,
    address: r.address ?? null,
    meetingLink: r.meetingLink ?? null,
    isRequired: r.isRequired,
    displayOnForm: r.displayOnForm,
    isPublic: r.isPublic,
    isAllDay: r.isAllDay,
    hasWaitlist: r.hasWaitlist,
    showAttendeeList: r.showAttendeeList,
    showAsSeparateEvent: r.showAsSeparateEvent,
    sessionKind: r.sessionKind,
    sortOrder: r.sortOrder,
    isMaster: r.isMaster,
    masterId: r.masterId ?? null,
    inviteeModes: asObj(r.inviteeModes),
    inviteeGroups: asObj(r.inviteeGroups),
    eligibility: asObj(r.eligibility),
    admins: asArray(r.admins),
    addons: asArray(r.addons),
    exdates: asArray(r.exdates).map(String),
  }
}

function toInvitee(r: typeof schema.invitees.$inferSelect): Invitee {
  return {
    id: r.id,
    eventId: r.eventId,
    sessionId: r.sessionId ?? null,
    personId: r.personId ?? null,
    status: r.status,
    roles: asArray(r.roles).map(String),
    role: r.role ?? null,
    attended: r.attended,
    signedOut: r.signedOut,
    subGroupId: r.subGroupId ?? null,
    invitedAt: toIso(r.invitedAt),
    respondedAt: toIso(r.respondedAt),
    inviteSentAt: toIso(r.inviteSentAt),
  }
}

function toRegistration(r: typeof schema.registrations.$inferSelect): Registration {
  return {
    id: r.id,
    eventId: r.eventId,
    personId: r.personId ?? null,
    guestName: r.guestName ?? null,
    guestEmail: r.guestEmail ?? null,
    status: r.status,
    ticketId: r.ticketId ?? null,
    totalAmount: r.totalAmount,
    paidAmount: r.paidAmount,
    formAnswers: asObj(r.formAnswers),
    checkedInAt: toIso(r.checkedInAt),
    createdAt: toIso(r.createdAt),
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

/** The dashboard's Upcoming-events widget: events starting at/after `nowIso`, excluding
 *  ARCHIVED/CANCELLED, earliest first, limited — plus the TOTAL matching count (so the
 *  widget can show "N upcoming" beyond the shown few). */
export async function upcomingEvents(
  orgId: string,
  nowIso: string,
  limit = 6,
): Promise<{ events: FMEvent[]; count: number }> {
  const where = and(
    eq(schema.events.orgId, orgId),
    ne(schema.events.status, 'ARCHIVED'),
    ne(schema.events.status, 'CANCELLED'),
    // startAt is a Drizzle date column — it needs a Date, not the ISO string
    // (Drizzle calls .toISOString() on the bound value).
    gte(schema.events.startAt, new Date(nowIso)),
  )
  const rows = await db.select().from(schema.events).where(where)
    .orderBy(asc(schema.events.startAt)).limit(limit)
  const all = await db.select({ id: schema.events.id }).from(schema.events).where(where)
  return { events: rows.map(toEvent), count: all.length }
}

/** One event by id, or null. */
export async function getEvent(id: string): Promise<FMEvent | null> {
  const [r] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1)
  return r ? toEvent(r) : null
}

/**
 * Every event linked to one member group (its training occurrences — master +
 * weekly children), earliest first. The group page reads these for its Upcoming
 * events / Session Times / attendance-report columns; each carries `locations` +
 * `memberGroupScheduleId` (which master a schedule row produced). Org-wide listEvents
 * would pull the whole club per group-page load — this is the scoped read.
 */
export async function listEventsByMemberGroup(groupId: string): Promise<FMEvent[]> {
  const rows = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.memberGroupId, groupId))
    .orderBy(asc(schema.events.startAt))
  return rows.map(toEvent)
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). json columns (exdates) are
// JSON.stringify'd on the way IN, mirroring asArray on the way OUT; timestamps
// accept ISO strings and store as Date. `as any` on the insert: the first-pass
// schema marks many columns .notNull() (from Postgres) without their defaults, so
// Drizzle over-requires them; the DB (defaults + relaxed mode) fills the rest.
// Consistent with the app's (db.from as any) idiom.
export async function createEvent(input: FMEventCreate): Promise<FMEvent> {
  const id = randomUUID()
  await db.insert(schema.events).values({
    id,
    orgId: input.orgId,
    title: input.title,
    description: input.description ?? null,
    style: input.style ?? 'BASIC',
    status: input.status ?? 'DRAFT',
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
    isPublic: input.isPublic ?? false,
    isProgramme: input.isProgramme ?? false,
    formId: input.formId ?? null,
    memberGroupId: input.memberGroupId ?? null,
    categoryId: input.categoryId ?? null,
    bannerUrl: input.bannerUrl ?? null,
    locationType: input.locationType ?? 'ADDRESS',
    bookableId: input.bookableId ?? null,
    address: input.address ?? null,
    meetingLink: input.meetingLink ?? null,
    locations: input.locations ?? null,
    ageMin: input.ageMin ?? null,
    ageMax: input.ageMax ?? null,
    genderRestriction: input.genderRestriction ?? null,
    recurrenceRule: input.recurrenceRule ?? null,
    recurrenceParentId: input.recurrenceParentId ?? null,
    createdVia: input.createdVia ?? null,
    exdates: input.exdates ?? [],
    isAllDay: input.isAllDay ?? false,
    secondaryCategoryId: input.secondaryCategoryId ?? null,
    capacityMin: input.capacityMin ?? null,
    capacityMax: input.capacityMax ?? null,
    showAttendeeList: input.showAttendeeList ?? true,
    showAttendeeCount: input.showAttendeeCount ?? true,
    allowInterest: input.allowInterest ?? false,
    allowGuests: input.allowGuests ?? false,
    maxGuestsPerInvitee: input.maxGuestsPerInvitee ?? null,
    holdSpotEnabled: input.holdSpotEnabled ?? false,
    holdSpotAgeMax: input.holdSpotAgeMax ?? null,
    phasedRegistration: input.phasedRegistration ?? false,
    memberWindowDays: input.memberWindowDays ?? 0,
    publicOpensAt: input.publicOpensAt ? new Date(input.publicOpensAt) : null,
    masterEventId: input.masterEventId ?? null,
    isFeatured: input.isFeatured ?? false,
    publicUrlSlug: input.publicUrlSlug ?? null,
    tcContent: input.tcContent ?? null,
    hasWaitlist: input.hasWaitlist ?? false,
    hasTickets: input.hasTickets ?? false,
    regOpenAt: input.regOpenAt ? new Date(input.regOpenAt) : null,
    regCloseAt: input.regCloseAt ? new Date(input.regCloseAt) : null,
    publishAt: input.publishAt ? new Date(input.publishAt) : null,
    notes: input.notes ?? null,
    hideBanner: input.hideBanner ?? false,
    xeroCodesLocked: input.xeroCodesLocked ?? false,
    memberGroupScheduleId: input.memberGroupScheduleId ?? null,
    attachments: input.attachments ?? null,
    subGroups: input.subGroups ?? null,
    sharingConfig: input.sharingConfig ?? null,
    automation: input.automation ?? null,
    invitationEmail: input.invitationEmail ?? null,
  } as any)
  return (await getEvent(id))!
}

export async function updateEvent(id: string, patch: FMEventPatch): Promise<FMEvent | null> {
  const set: Record<string, any> = {}
  if (patch.orgId !== undefined) set.orgId = patch.orgId
  if (patch.title !== undefined) set.title = patch.title
  if (patch.description !== undefined) set.description = patch.description
  if (patch.style !== undefined) set.style = patch.style
  if (patch.status !== undefined) set.status = patch.status
  if (patch.startAt !== undefined) set.startAt = patch.startAt ? new Date(patch.startAt) : null
  if (patch.endAt !== undefined) set.endAt = patch.endAt ? new Date(patch.endAt) : null
  if (patch.isPublic !== undefined) set.isPublic = patch.isPublic
  if (patch.isProgramme !== undefined) set.isProgramme = patch.isProgramme
  if (patch.formId !== undefined) set.formId = patch.formId
  if (patch.memberGroupId !== undefined) set.memberGroupId = patch.memberGroupId
  if (patch.categoryId !== undefined) set.categoryId = patch.categoryId
  if (patch.bannerUrl !== undefined) set.bannerUrl = patch.bannerUrl
  if (patch.locationType !== undefined) set.locationType = patch.locationType
  if (patch.bookableId !== undefined) set.bookableId = patch.bookableId
  if (patch.address !== undefined) set.address = patch.address
  if (patch.meetingLink !== undefined) set.meetingLink = patch.meetingLink
  if (patch.locations !== undefined) set.locations = patch.locations
  if (patch.ageMin !== undefined) set.ageMin = patch.ageMin
  if (patch.ageMax !== undefined) set.ageMax = patch.ageMax
  if (patch.genderRestriction !== undefined) set.genderRestriction = patch.genderRestriction
  if (patch.recurrenceRule !== undefined) set.recurrenceRule = patch.recurrenceRule
  if (patch.recurrenceParentId !== undefined) set.recurrenceParentId = patch.recurrenceParentId
  if (patch.createdVia !== undefined) set.createdVia = patch.createdVia
  if (patch.exdates !== undefined) set.exdates = patch.exdates ?? []
  if (patch.isAllDay !== undefined) set.isAllDay = patch.isAllDay
  if (patch.secondaryCategoryId !== undefined) set.secondaryCategoryId = patch.secondaryCategoryId
  if (patch.capacityMin !== undefined) set.capacityMin = patch.capacityMin
  if (patch.capacityMax !== undefined) set.capacityMax = patch.capacityMax
  if (patch.showAttendeeList !== undefined) set.showAttendeeList = patch.showAttendeeList
  if (patch.showAttendeeCount !== undefined) set.showAttendeeCount = patch.showAttendeeCount
  if (patch.allowInterest !== undefined) set.allowInterest = patch.allowInterest
  if (patch.allowGuests !== undefined) set.allowGuests = patch.allowGuests
  if (patch.maxGuestsPerInvitee !== undefined) set.maxGuestsPerInvitee = patch.maxGuestsPerInvitee
  if (patch.holdSpotEnabled !== undefined) set.holdSpotEnabled = patch.holdSpotEnabled
  if (patch.holdSpotAgeMax !== undefined) set.holdSpotAgeMax = patch.holdSpotAgeMax
  if (patch.phasedRegistration !== undefined) set.phasedRegistration = patch.phasedRegistration
  if (patch.memberWindowDays !== undefined) set.memberWindowDays = patch.memberWindowDays
  if (patch.publicOpensAt !== undefined) set.publicOpensAt = patch.publicOpensAt ? new Date(patch.publicOpensAt) : null
  if (patch.masterEventId !== undefined) set.masterEventId = patch.masterEventId
  if (patch.isFeatured !== undefined) set.isFeatured = patch.isFeatured
  if (patch.publicUrlSlug !== undefined) set.publicUrlSlug = patch.publicUrlSlug
  if (patch.tcContent !== undefined) set.tcContent = patch.tcContent
  if (patch.hasWaitlist !== undefined) set.hasWaitlist = patch.hasWaitlist
  if (patch.hasTickets !== undefined) set.hasTickets = patch.hasTickets
  if (patch.regOpenAt !== undefined) set.regOpenAt = patch.regOpenAt ? new Date(patch.regOpenAt) : null
  if (patch.regCloseAt !== undefined) set.regCloseAt = patch.regCloseAt ? new Date(patch.regCloseAt) : null
  if (patch.publishAt !== undefined) set.publishAt = patch.publishAt ? new Date(patch.publishAt) : null
  if (patch.notes !== undefined) set.notes = patch.notes
  if (patch.hideBanner !== undefined) set.hideBanner = patch.hideBanner
  if (patch.xeroCodesLocked !== undefined) set.xeroCodesLocked = patch.xeroCodesLocked
  if (patch.memberGroupScheduleId !== undefined) set.memberGroupScheduleId = patch.memberGroupScheduleId
  if (patch.attachments !== undefined) set.attachments = patch.attachments
  if (patch.subGroups !== undefined) set.subGroups = patch.subGroups
  if (patch.sharingConfig !== undefined) set.sharingConfig = patch.sharingConfig
  if (patch.automation !== undefined) set.automation = patch.automation
  if (patch.invitationEmail !== undefined) set.invitationEmail = patch.invitationEmail
  if (Object.keys(set).length) await db.update(schema.events).set(set).where(eq(schema.events.id, id))
  return getEvent(id)
}

export async function deleteEvent(id: string): Promise<void> {
  // Clear any club invitations for this event first — a deleted event must leave no
  // orphan invite lingering on a club's dashboard.
  await db.delete(schema.eventOrgInvitees).where(eq(schema.eventOrgInvitees.eventId, id))
  await db.delete(schema.events).where(eq(schema.events.id, id))
}

/**
 * The sessions of an event, in author order. By default returns EVERY session (masters
 * + sub-sessions); the session editor splits them by parentSessionId in JS. Optional
 * filter: `masters: true` → only top-level sessions (parent_session_id IS NULL);
 * `parentSessionId: <id>` → only the sub-sessions of that parent.
 */
export async function listSessions(
  eventId: string,
  opts: { masters?: boolean; parentSessionId?: string } = {},
): Promise<Session[]> {
  const preds: any[] = [eq(schema.sessions.eventId, eventId)]
  if (opts.masters) preds.push(isNull(schema.sessions.parentSessionId))
  else if (opts.parentSessionId) preds.push(eq(schema.sessions.parentSessionId, opts.parentSessionId))
  const rows = await db
    .select()
    .from(schema.sessions)
    .where(and(...preds))
    .orderBy(asc(schema.sessions.sortOrder))
  return rows.map(toSession)
}

/** One session by id, or null. */
export async function getSession(id: string): Promise<Session | null> {
  const [r] = await db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).limit(1)
  return r ? toSession(r) : null
}

/** Org-wide "separate sessions": sessions flagged show_as_separate_event, top-level
 *  (no parent), with a start — each carrying a small slice of its parent event. The
 *  events calendar renders these as their own items. No per-event seam covers this
 *  cross-event read, so it lives here as a purpose-built join. */
export async function separateSessionsForOrg(orgId: string): Promise<SeparateSession[]> {
  const rows = await db
    .select({
      s: schema.sessions,
      eventId: schema.events.id,
      eventTitle: schema.events.title,
      eventStatus: schema.events.status,
      eventOrgId: schema.events.orgId,
      eventCategoryId: schema.events.categoryId,
      eventIsProgramme: schema.events.isProgramme,
    })
    .from(schema.sessions)
    .innerJoin(schema.events, eq(schema.sessions.eventId, schema.events.id))
    .where(and(
      eq(schema.events.orgId, orgId),
      eq(schema.sessions.showAsSeparateEvent, true),
      isNull(schema.sessions.parentSessionId),
      isNotNull(schema.sessions.startAt),
    ))
  return rows.map((r) => ({
    ...toSession(r.s),
    event: {
      id: r.eventId,
      title: r.eventTitle,
      status: r.eventStatus,
      orgId: r.eventOrgId,
      categoryId: r.eventCategoryId ?? null,
      isProgramme: !!r.eventIsProgramme,
    },
  }))
}

// ── Session writes ──
// Repo owns the id; json columns (addons) are JSON.stringify'd on the way IN;
// timestamps accept ISO strings and store as Date. `title` is a required DB column
// not on the read shape, so it's carried on the create contract. `as any` per the
// insert idiom above.
export async function createSession(input: SessionCreate): Promise<Session> {
  const id = randomUUID()
  await db.insert(schema.sessions).values({
    id,
    eventId: input.eventId,
    parentSessionId: input.parentSessionId ?? null,
    title: input.title,
    description: input.description ?? null,
    startAt: input.startAt ? new Date(input.startAt) : null,
    endAt: input.endAt ? new Date(input.endAt) : null,
    capacityMin: input.capacityMin ?? null,
    capacityMax: input.capacityMax ?? null,
    locationType: input.locationType ?? 'ADDRESS',
    bookableId: input.bookableId ?? null,
    address: input.address ?? null,
    meetingLink: input.meetingLink ?? null,
    isRequired: input.isRequired ?? false,
    displayOnForm: input.displayOnForm ?? true,
    isPublic: input.isPublic ?? false,
    isAllDay: input.isAllDay ?? false,
    hasWaitlist: input.hasWaitlist ?? false,
    showAttendeeList: input.showAttendeeList ?? false,
    showAsSeparateEvent: input.showAsSeparateEvent ?? false,
    // session_kind is NOT NULL with no DB default; the editor writes 'regular'.
    sessionKind: input.sessionKind ?? 'regular',
    sortOrder: input.sortOrder ?? 0,
    isMaster: input.isMaster ?? false,
    masterId: input.masterId ?? null,
    inviteeModes: input.inviteeModes ?? null,
    inviteeGroups: input.inviteeGroups ?? null,
    eligibility: input.eligibility ?? null,
    admins: input.admins ?? [],
    addons: input.addons ?? [],
    exdates: input.exdates ?? [],
  } as any)
  return (await getSession(id))!
}

// Builds the Drizzle `set` object shared by updateSession + updateSessionsByMaster.
function sessionPatchToSet(patch: SessionPatch): Record<string, any> {
  const set: Record<string, any> = {}
  if (patch.eventId !== undefined) set.eventId = patch.eventId
  if (patch.parentSessionId !== undefined) set.parentSessionId = patch.parentSessionId
  if (patch.title !== undefined) set.title = patch.title
  if (patch.description !== undefined) set.description = patch.description
  if (patch.startAt !== undefined) set.startAt = patch.startAt ? new Date(patch.startAt) : null
  if (patch.endAt !== undefined) set.endAt = patch.endAt ? new Date(patch.endAt) : null
  if (patch.capacityMin !== undefined) set.capacityMin = patch.capacityMin
  if (patch.capacityMax !== undefined) set.capacityMax = patch.capacityMax
  if (patch.locationType !== undefined) set.locationType = patch.locationType
  if (patch.bookableId !== undefined) set.bookableId = patch.bookableId
  if (patch.address !== undefined) set.address = patch.address
  if (patch.meetingLink !== undefined) set.meetingLink = patch.meetingLink
  if (patch.isRequired !== undefined) set.isRequired = patch.isRequired
  if (patch.displayOnForm !== undefined) set.displayOnForm = patch.displayOnForm
  if (patch.isPublic !== undefined) set.isPublic = patch.isPublic
  if (patch.isAllDay !== undefined) set.isAllDay = patch.isAllDay
  if (patch.hasWaitlist !== undefined) set.hasWaitlist = patch.hasWaitlist
  if (patch.showAttendeeList !== undefined) set.showAttendeeList = patch.showAttendeeList
  if (patch.showAsSeparateEvent !== undefined) set.showAsSeparateEvent = patch.showAsSeparateEvent
  if (patch.sessionKind !== undefined) set.sessionKind = patch.sessionKind
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.isMaster !== undefined) set.isMaster = patch.isMaster
  if (patch.masterId !== undefined) set.masterId = patch.masterId
  if (patch.inviteeModes !== undefined) set.inviteeModes = patch.inviteeModes ?? null
  if (patch.inviteeGroups !== undefined) set.inviteeGroups = patch.inviteeGroups ?? null
  if (patch.eligibility !== undefined) set.eligibility = patch.eligibility ?? null
  if (patch.admins !== undefined) set.admins = patch.admins ?? []
  if (patch.addons !== undefined) set.addons = patch.addons ?? []
  if (patch.exdates !== undefined) set.exdates = patch.exdates ?? []
  return set
}

export async function updateSession(id: string, patch: SessionPatch): Promise<Session | null> {
  const set = sessionPatchToSet(patch)
  if (Object.keys(set).length) await db.update(schema.sessions).set(set).where(eq(schema.sessions.id, id))
  return getSession(id)
}

/**
 * Bulk-update every LINKED session of a master (master→linked field inheritance). Scoped
 * to (event, master) so it never reaches another event's rows — replaces the page's
 * `.update(...).eq('master_id', masterId).eq('event_id', eventId)` in one call.
 */
export async function updateSessionsByMaster(
  masterId: string,
  eventId: string,
  patch: SessionPatch,
): Promise<void> {
  const set = sessionPatchToSet(patch)
  if (!Object.keys(set).length) return
  await db
    .update(schema.sessions)
    .set(set)
    .where(and(eq(schema.sessions.masterId, masterId), eq(schema.sessions.eventId, eventId)))
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, id))
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

/**
 * Ticket-order registrations for an event: registrations with a ticket_id, each with
 * its nested ticket line-items (registration_ticket_items) carrying the ticket-type's
 * name (a ticket_types join). Two queries (orders, then items joined to ticket_types),
 * stitched in JS. Newest order first. (gap — the tickets-tab orders read.)
 */
export async function listTicketOrders(eventId: string): Promise<TicketOrder[]> {
  const regs = await db
    .select()
    .from(schema.registrations)
    .where(eq(schema.registrations.eventId, eventId))
    .orderBy(desc(schema.registrations.createdAt))
  const orders = regs.filter((r) => r.ticketId != null)
  if (!orders.length) return []
  const orderIds = orders.map((r) => r.id)
  const itemRows = await db
    .select({
      item: schema.registrationTicketItems,
      ticketTypeName: schema.ticketTypes.name,
    })
    .from(schema.registrationTicketItems)
    .leftJoin(schema.ticketTypes, eq(schema.registrationTicketItems.ticketTypeId, schema.ticketTypes.id))
    .where(inArray(schema.registrationTicketItems.registrationId, orderIds))
  const itemsByReg: Record<string, TicketOrder['items']> = {}
  for (const r of itemRows) {
    ;(itemsByReg[r.item.registrationId] ||= []).push({
      id: r.item.id,
      quantity: r.item.quantity,
      unitPrice: r.item.unitPrice,
      subtotal: r.item.subtotal,
      ticketTypeName: r.ticketTypeName ?? '—',
    })
  }
  return orders.map((r) => ({
    id: r.id,
    guestName: r.guestName ?? null,
    guestEmail: r.guestEmail ?? null,
    status: r.status,
    ticketId: r.ticketId ?? null,
    totalAmount: r.totalAmount,
    checkedInAt: toIso(r.checkedInAt),
    items: itemsByReg[r.id] ?? [],
  }))
}

/**
 * Every invitee row for one PERSON across all events, enriched with the event's
 * title + start date + status — the profile activity feed's source. Joins
 * invitees → events so the caller can render "invited to {title} on {date}" without
 * a second query. Newest invite first. (cross-domain gap D9)
 */
export async function inviteesForPerson(personId: string): Promise<InviteeForPerson[]> {
  const rows = await db
    .select({
      inv: schema.invitees,
      eventTitle: schema.events.title,
      eventStartAt: schema.events.startAt,
      eventStatus: schema.events.status,
    })
    .from(schema.invitees)
    .innerJoin(schema.events, eq(schema.invitees.eventId, schema.events.id))
    .where(eq(schema.invitees.personId, personId))
    .orderBy(desc(schema.invitees.invitedAt))
  return rows.map((r) => ({
    ...toInvitee(r.inv),
    eventTitle: r.eventTitle,
    eventStartAt: toIso(r.eventStartAt),
    eventStatus: r.eventStatus,
  }))
}

/**
 * Per-event invitee totals for a whole org — one row per event with a total +
 * CONFIRMED count. Powers the events reporting page (which otherwise batches invitee
 * reads across every event). One join query, reduced in JS.
 */
export async function inviteeCountsByOrg(
  orgId: string,
): Promise<{ eventId: string; total: number; confirmed: number }[]> {
  const rows = await db
    .select({ eventId: schema.invitees.eventId, status: schema.invitees.status })
    .from(schema.invitees)
    .innerJoin(schema.events, eq(schema.invitees.eventId, schema.events.id))
    .where(eq(schema.events.orgId, orgId))
  const map: Record<string, { eventId: string; total: number; confirmed: number }> = {}
  for (const r of rows) {
    const m = (map[r.eventId] ||= { eventId: r.eventId, total: 0, confirmed: 0 })
    m.total++
    if (r.status === 'CONFIRMED') m.confirmed++
  }
  return Object.values(map)
}

// ── Invitee writes ──
// The invitees table has no read/update contract writes yet in the seam; the event
// editor needs to create/update/delete them. Repo owns the id; roles is a json array.
export async function createInvitee(input: {
  eventId: string; personId?: string | null; status?: string; roles?: string[]
  sessionId?: string | null; role?: string | null
}): Promise<Invitee> {
  const id = randomUUID()
  await db.insert(schema.invitees).values({
    id,
    eventId: input.eventId,
    sessionId: input.sessionId ?? null,
    personId: input.personId ?? null,
    status: input.status ?? 'INVITED',
    roles: input.roles ?? [],
    role: input.role ?? null,
  } as any)
  const [r] = await db.select().from(schema.invitees).where(eq(schema.invitees.id, id)).limit(1)
  return toInvitee(r)
}

export async function updateInvitee(id: string, patch: {
  status?: string; roles?: string[]; role?: string | null; attended?: boolean
  signedOut?: boolean; subGroupId?: string | null
  respondedAt?: string | null; personId?: string | null
}): Promise<Invitee | null> {
  const set: Record<string, any> = {}
  if (patch.status !== undefined) set.status = patch.status
  if (patch.roles !== undefined) set.roles = patch.roles
  if (patch.role !== undefined) set.role = patch.role
  if (patch.attended !== undefined) set.attended = patch.attended
  if (patch.signedOut !== undefined) set.signedOut = patch.signedOut
  if (patch.subGroupId !== undefined) set.subGroupId = patch.subGroupId
  if (patch.respondedAt !== undefined) set.respondedAt = patch.respondedAt ? new Date(patch.respondedAt) : null
  if (patch.personId !== undefined) set.personId = patch.personId
  if (Object.keys(set).length) await db.update(schema.invitees).set(set).where(eq(schema.invitees.id, id))
  const [r] = await db.select().from(schema.invitees).where(eq(schema.invitees.id, id)).limit(1)
  return r ? toInvitee(r) : null
}

/**
 * The invitees of an event JOINED to their persons row — the shape the Invitees +
 * Attendance tabs actually render (name search, sub-groups, sign-out). Left-joins
 * persons so a guest invitee (null person_id) still comes back with person=null. Oldest
 * invite first. (NEW gap — the mega-file invitees/attendance read.)
 */
export async function inviteesForEvent(eventId: string): Promise<InviteeWithPerson[]> {
  const rows = await db
    .select({
      inv: schema.invitees,
      pid: schema.persons.id,
      firstName: schema.persons.firstName,
      lastName: schema.persons.lastName,
      email: schema.persons.email,
      dob: schema.persons.dob,
      gender: schema.persons.gender,
      photoUrl: schema.persons.photoUrl,
      phone: schema.persons.phone,
      phone2: schema.persons.phone2,
      membershipType: schema.persons.membershipType,
      customFields: schema.persons.customFields,
    })
    .from(schema.invitees)
    .leftJoin(schema.persons, eq(schema.invitees.personId, schema.persons.id))
    .where(eq(schema.invitees.eventId, eventId))
    .orderBy(asc(schema.invitees.invitedAt))
  return rows.map((r) => ({
    ...toInvitee(r.inv),
    person: r.pid
      ? {
          id: r.pid,
          firstName: r.firstName ?? null,
          lastName: r.lastName ?? null,
          email: r.email ?? null,
          dateOfBirth: toDateStr(r.dob),
          gender: r.gender ?? null,
          photoUrl: r.photoUrl ?? null,
          phone: r.phone ?? null,
          phone2: r.phone2 ?? null,
          membershipType: r.membershipType ?? null,
          customFields: (r.customFields as Record<string, any>) ?? null,
        }
      : null,
  }))
}

export async function deleteInvitee(id: string): Promise<void> {
  await db.delete(schema.invitees).where(eq(schema.invitees.id, id))
}

// ── Event org (club) invitees ──
function toEventOrgInvitee(r: typeof schema.eventOrgInvitees.$inferSelect): EventOrgInvitee {
  return {
    id: r.id,
    eventId: r.eventId,
    orgId: r.orgId,
    invitedByOrgId: r.invitedByOrgId ?? null,
    status: r.status,
    connections: (r.connections as EventConnections) ?? null,
    disciplineId: r.disciplineId ?? null,
    invitedAt: toIso(r.invitedAt),
    updatedAt: toIso(r.updatedAt),
    decidedAt: toIso(r.decidedAt),
  }
}

/** The clubs invited to an event, oldest first, with the club name joined for display. */
export async function listEventOrgInvitees(eventId: string): Promise<EventOrgInviteeWithName[]> {
  const rows = await db
    .select({ inv: schema.eventOrgInvitees, orgName: schema.organisations.name, disciplineName: schema.disciplines.name })
    .from(schema.eventOrgInvitees)
    .leftJoin(schema.organisations, eq(schema.organisations.id, schema.eventOrgInvitees.orgId))
    .leftJoin(schema.disciplines, eq(schema.disciplines.id, schema.eventOrgInvitees.disciplineId))
    .where(eq(schema.eventOrgInvitees.eventId, eventId))
    .orderBy(asc(schema.eventOrgInvitees.invitedAt))
  return rows.map(r => ({ ...toEventOrgInvitee(r.inv), orgName: r.orgName ?? null, disciplineName: r.disciplineName ?? null }))
}

/** Invite a club to an event. Idempotent on (event_id, org_id) — re-inviting is a no-op. */
export async function createEventOrgInvitee(input: {
  eventId: string; orgId: string; invitedByOrgId?: string | null; status?: string; disciplineId?: string | null
}): Promise<EventOrgInvitee> {
  // Idempotent on (event_id, org_id): re-inviting the same club returns the existing
  // row UNCHANGED, so changing an invite's discipline = remove + re-add (host decision).
  const [existing] = await db.select().from(schema.eventOrgInvitees)
    .where(and(eq(schema.eventOrgInvitees.eventId, input.eventId), eq(schema.eventOrgInvitees.orgId, input.orgId)))
    .limit(1)
  if (existing) return toEventOrgInvitee(existing)
  const id = randomUUID()
  await db.insert(schema.eventOrgInvitees).values({
    id,
    eventId: input.eventId,
    orgId: input.orgId,
    invitedByOrgId: input.invitedByOrgId ?? null,
    status: input.status ?? 'INVITED',
    disciplineId: input.disciplineId ?? null,
  } as any)
  const [r] = await db.select().from(schema.eventOrgInvitees).where(eq(schema.eventOrgInvitees.id, id)).limit(1)
  return toEventOrgInvitee(r)
}

export async function deleteEventOrgInvitee(id: string): Promise<void> {
  await db.delete(schema.eventOrgInvitees).where(eq(schema.eventOrgInvitees.id, id))
}

/** The invitations aimed AT a club (its own dashboard view) — with the event + the
 *  inviting body's name joined so it can render "{Body} invited you to {Event}". */
export async function listEventOrgInvitesForClub(orgId: string): Promise<EventOrgInviteForClub[]> {
  const rows = await db
    .select({
      inv: schema.eventOrgInvitees,
      eventTitle: schema.events.title,
      eventStartAt: schema.events.startAt,
      eventBannerUrl: schema.events.bannerUrl,
      invitedByOrgName: schema.organisations.name,
      disciplineName: schema.disciplines.name,
    })
    .from(schema.eventOrgInvitees)
    // INNER join on events: if the host DELETED the event, the invite's orphan row
    // must NOT show on the club — a deleted event disappears from the club inbox.
    .innerJoin(schema.events, eq(schema.events.id, schema.eventOrgInvitees.eventId))
    .leftJoin(schema.organisations, eq(schema.organisations.id, schema.eventOrgInvitees.invitedByOrgId))
    .leftJoin(schema.disciplines, eq(schema.disciplines.id, schema.eventOrgInvitees.disciplineId))
    .where(eq(schema.eventOrgInvitees.orgId, orgId))
    .orderBy(desc(schema.eventOrgInvitees.invitedAt))
  return rows.map(r => ({
    ...toEventOrgInvitee(r.inv),
    eventTitle: r.eventTitle ?? null,
    eventStartAt: toIso(r.eventStartAt),
    eventBannerUrl: r.eventBannerUrl ?? null,
    invitedByOrgName: r.invitedByOrgName ?? null,
    disciplineName: r.disciplineName ?? null,
  }))
}

/** The club accepts/declines (status + decided_at) and/or sets what it connects. */
export async function respondEventOrgInvitee(
  id: string, patch: { status?: string; connections?: EventConnections },
): Promise<EventOrgInvitee | null> {
  const set: Record<string, any> = { updatedAt: new Date() }
  if (patch.status !== undefined) { set.status = patch.status; set.decidedAt = new Date() }
  if (patch.connections !== undefined) set.connections = patch.connections
  await db.update(schema.eventOrgInvitees).set(set).where(eq(schema.eventOrgInvitees.id, id))
  const [r] = await db.select().from(schema.eventOrgInvitees).where(eq(schema.eventOrgInvitees.id, id)).limit(1)
  return r ? toEventOrgInvitee(r) : null
}

// ── Registration writes ──
export async function createRegistration(input: RegistrationCreate): Promise<Registration> {
  const id = randomUUID()
  await db.insert(schema.registrations).values({
    id,
    eventId: input.eventId,
    personId: input.personId ?? null,
    guestName: input.guestName ?? null,
    guestEmail: input.guestEmail ?? null,
    ticketId: input.ticketId ?? null,
    status: input.status ?? 'CONFIRMED',
    totalAmount: (input.totalAmount as any) ?? 0,
    paidAmount: (input.paidAmount as any) ?? 0,
    formAnswers: input.formAnswers ?? null,
    checkedInAt: input.checkedInAt ? new Date(input.checkedInAt) : null,
  } as any)
  const [r] = await db.select().from(schema.registrations).where(eq(schema.registrations.id, id)).limit(1)
  return toRegistration(r)
}

export async function updateRegistration(id: string, patch: RegistrationPatch): Promise<Registration | null> {
  const set: Record<string, any> = {}
  if (patch.status !== undefined) set.status = patch.status
  if (patch.totalAmount !== undefined) set.totalAmount = patch.totalAmount
  if (patch.paidAmount !== undefined) set.paidAmount = patch.paidAmount
  if (patch.formAnswers !== undefined) set.formAnswers = patch.formAnswers
  if (patch.checkedInAt !== undefined) set.checkedInAt = patch.checkedInAt ? new Date(patch.checkedInAt) : null
  if (patch.personId !== undefined) set.personId = patch.personId
  if (Object.keys(set).length) await db.update(schema.registrations).set(set).where(eq(schema.registrations.id, id))
  const [r] = await db.select().from(schema.registrations).where(eq(schema.registrations.id, id)).limit(1)
  return r ? toRegistration(r) : null
}

export async function deleteRegistration(id: string): Promise<void> {
  await db.delete(schema.registrations).where(eq(schema.registrations.id, id))
}

/** The session selections of a registration. */
export async function listRegistrationSessions(registrationId: string): Promise<RegistrationSession[]> {
  const rows = await db
    .select()
    .from(schema.registrationSessions)
    .where(eq(schema.registrationSessions.registrationId, registrationId))
  return rows.map((r) => ({
    id: r.id, registrationId: r.registrationId, sessionId: r.sessionId, status: r.status,
  }))
}

/**
 * Registration-session rows for a SET of sessions (across all registrations) — used
 * by the programme date table to count CONFIRMED bookings per session occurrence.
 */
export async function listRegistrationSessionsBySessions(sessionIds: string[]): Promise<RegistrationSession[]> {
  if (!sessionIds.length) return []
  const rows = await db
    .select()
    .from(schema.registrationSessions)
    .where(inArray(schema.registrationSessions.sessionId, sessionIds))
  return rows.map((r) => ({
    id: r.id, registrationId: r.registrationId, sessionId: r.sessionId, status: r.status,
  }))
}

export async function createRegistrationSession(input: {
  registrationId: string; sessionId: string; status?: string
}): Promise<RegistrationSession> {
  const id = randomUUID()
  await db.insert(schema.registrationSessions).values({
    id, registrationId: input.registrationId, sessionId: input.sessionId,
    status: input.status ?? 'CONFIRMED',
  } as any)
  return { id, registrationId: input.registrationId, sessionId: input.sessionId, status: input.status ?? 'CONFIRMED' }
}

// ── Fee components ──
// A fee line belongs to an event OR a session. Session fees are keyed by session_id,
// NOT event_id — so reads take one or the other (or both, for an event + its sessions).
function toFee(r: typeof schema.feeComponents.$inferSelect): FeeComponent {
  return {
    id: r.id,
    eventId: r.eventId ?? null,
    sessionId: r.sessionId ?? null,
    name: r.name,
    amount: r.amount,
    xeroCode: r.xeroCode ?? null,
    isLocked: r.isLocked,
    depositPercent: r.depositPercent ?? null,
    sortOrder: r.sortOrder,
  }
}

/** Fee lines for an event, its sessions, or both. Pass eventId and/or sessionIds. */
export async function listFeeComponents(opts: { eventId?: string; sessionIds?: string[] }): Promise<FeeComponent[]> {
  const preds: any[] = []
  if (opts.eventId) preds.push(eq(schema.feeComponents.eventId, opts.eventId))
  if (opts.sessionIds && opts.sessionIds.length) preds.push(inArray(schema.feeComponents.sessionId, opts.sessionIds))
  if (!preds.length) return []
  const rows = await db
    .select()
    .from(schema.feeComponents)
    // eventId match OR sessionId match — a fee is on one or the other.
    .where(preds.length === 1 ? preds[0] : or(...preds))
    .orderBy(asc(schema.feeComponents.sortOrder))
  return rows.map(toFee)
}

export async function createFeeComponent(input: FeeComponentCreate): Promise<FeeComponent> {
  const id = randomUUID()
  await db.insert(schema.feeComponents).values({
    id,
    eventId: input.eventId ?? null,
    sessionId: input.sessionId ?? null,
    name: input.name,
    amount: (input.amount as any) ?? 0,
    xeroCode: input.xeroCode ?? null,
    isLocked: input.isLocked ?? false,
    depositPercent: (input.depositPercent as any) ?? null,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  const [r] = await db.select().from(schema.feeComponents).where(eq(schema.feeComponents.id, id)).limit(1)
  return toFee(r)
}

export async function updateFeeComponent(id: string, patch: FeeComponentPatch): Promise<FeeComponent | null> {
  const set: Record<string, any> = {}
  if (patch.eventId !== undefined) set.eventId = patch.eventId
  if (patch.sessionId !== undefined) set.sessionId = patch.sessionId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.amount !== undefined) set.amount = patch.amount
  if (patch.xeroCode !== undefined) set.xeroCode = patch.xeroCode
  if (patch.isLocked !== undefined) set.isLocked = patch.isLocked
  if (patch.depositPercent !== undefined) set.depositPercent = patch.depositPercent
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.feeComponents).set(set).where(eq(schema.feeComponents.id, id))
  const [r] = await db.select().from(schema.feeComponents).where(eq(schema.feeComponents.id, id)).limit(1)
  return r ? toFee(r) : null
}

export async function deleteFeeComponent(id: string): Promise<void> {
  await db.delete(schema.feeComponents).where(eq(schema.feeComponents.id, id))
}

/** Replace every fee line for one event (delete-then-insert), keeping author order. */
export async function replaceEventFeeComponents(eventId: string, items: FeeComponentCreate[]): Promise<FeeComponent[]> {
  await db.delete(schema.feeComponents).where(eq(schema.feeComponents.eventId, eventId))
  for (let i = 0; i < items.length; i++) {
    await createFeeComponent({ ...items[i], eventId, sortOrder: items[i].sortOrder ?? i })
  }
  return listFeeComponents({ eventId })
}

/**
 * Replace every fee line for one SESSION (delete-then-insert). Session fees are keyed by
 * session_id (never event_id) — the session editor's saveSessionFees + the master→linked
 * fee propagation both do exactly this. Keeps author order.
 */
export async function replaceSessionFeeComponents(sessionId: string, items: FeeComponentCreate[]): Promise<FeeComponent[]> {
  await db.delete(schema.feeComponents).where(eq(schema.feeComponents.sessionId, sessionId))
  for (let i = 0; i < items.length; i++) {
    await createFeeComponent({ ...items[i], sessionId, sortOrder: items[i].sortOrder ?? i })
  }
  return listFeeComponents({ sessionIds: [sessionId] })
}

// ── Event notes ──
function toNote(r: typeof schema.eventNotes.$inferSelect): EventNote {
  return {
    id: r.id, eventId: r.eventId, title: r.title ?? null, content: r.content,
    createdAt: toIso(r.createdAt), updatedAt: toIso(r.updatedAt),
  }
}
export async function listEventNotes(eventId: string): Promise<EventNote[]> {
  const rows = await db.select().from(schema.eventNotes)
    .where(eq(schema.eventNotes.eventId, eventId)).orderBy(desc(schema.eventNotes.createdAt))
  return rows.map(toNote)
}
export async function createEventNote(input: EventNoteCreate): Promise<EventNote> {
  const id = randomUUID()
  await db.insert(schema.eventNotes).values({
    id, eventId: input.eventId, title: input.title ?? null, content: input.content,
  } as any)
  const [r] = await db.select().from(schema.eventNotes).where(eq(schema.eventNotes.id, id)).limit(1)
  return toNote(r)
}
export async function updateEventNote(id: string, patch: EventNotePatch): Promise<EventNote | null> {
  const set: Record<string, any> = { updatedAt: new Date() }
  if (patch.title !== undefined) set.title = patch.title
  if (patch.content !== undefined) set.content = patch.content
  await db.update(schema.eventNotes).set(set).where(eq(schema.eventNotes.id, id))
  const [r] = await db.select().from(schema.eventNotes).where(eq(schema.eventNotes.id, id)).limit(1)
  return r ? toNote(r) : null
}
export async function deleteEventNote(id: string): Promise<void> {
  await db.delete(schema.eventNotes).where(eq(schema.eventNotes.id, id))
}

// ── Event tasks ──
// A `date` column comes back as a Date or a 'YYYY-MM-DD' string depending on driver
// config; normalise to the date-only string the UI expects (never a full ISO time).
function toDateStr(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

function toTask(r: typeof schema.eventTasks.$inferSelect): EventTask {
  return {
    id: r.id, eventId: r.eventId, text: r.text, done: r.done,
    dueDate: toDateStr(r.dueDate),
    assigneeIds: asArray(r.assigneeIds).map(String),
    isRole: r.isRole, roleCapacity: r.roleCapacity,
  }
}
export async function listEventTasks(eventId: string): Promise<EventTask[]> {
  const rows = await db.select().from(schema.eventTasks)
    .where(eq(schema.eventTasks.eventId, eventId)).orderBy(asc(schema.eventTasks.createdAt))
  return rows.map(toTask)
}
export async function createEventTask(input: EventTaskCreate): Promise<EventTask> {
  const id = randomUUID()
  await db.insert(schema.eventTasks).values({
    id, eventId: input.eventId, text: input.text, done: input.done ?? false,
    dueDate: input.dueDate ?? null, assigneeIds: input.assigneeIds ?? [],
    isRole: input.isRole ?? false, roleCapacity: input.roleCapacity ?? 0,
  } as any)
  const [r] = await db.select().from(schema.eventTasks).where(eq(schema.eventTasks.id, id)).limit(1)
  return toTask(r)
}
export async function updateEventTask(id: string, patch: EventTaskPatch): Promise<EventTask | null> {
  const set: Record<string, any> = {}
  if (patch.text !== undefined) set.text = patch.text
  if (patch.done !== undefined) set.done = patch.done
  if (patch.dueDate !== undefined) set.dueDate = patch.dueDate
  if (patch.assigneeIds !== undefined) set.assigneeIds = patch.assigneeIds
  if (patch.isRole !== undefined) set.isRole = patch.isRole
  if (patch.roleCapacity !== undefined) set.roleCapacity = patch.roleCapacity
  if (Object.keys(set).length) await db.update(schema.eventTasks).set(set).where(eq(schema.eventTasks.id, id))
  const [r] = await db.select().from(schema.eventTasks).where(eq(schema.eventTasks.id, id)).limit(1)
  return r ? toTask(r) : null
}
export async function deleteEventTask(id: string): Promise<void> {
  await db.delete(schema.eventTasks).where(eq(schema.eventTasks.id, id))
}

// ── Event categories ──
function toCategory(r: typeof schema.categories.$inferSelect): EventCategory {
  return {
    id: r.id, orgId: r.orgId, parentId: r.parentId ?? null, name: r.name,
    color: r.color ?? null, icon: r.icon ?? null, defaultTc: r.defaultTc ?? null,
    defaultFormId: r.defaultFormId ?? null, defaultXeroCodes: asObj(r.defaultXeroCodes),
    defaultDisciplineId: r.defaultDisciplineId ?? null,
    accessTypeKeys: (() => { const a = asArray(r.accessTypeKeys) as string[]; return a.length ? a : null })(),
    accessPersonIds: (() => { const a = asArray(r.accessPersonIds) as string[]; return a.length ? a : null })(),
    sortOrder: r.sortOrder,
  }
}
export async function listCategories(orgId: string): Promise<EventCategory[]> {
  const rows = await db.select().from(schema.categories)
    .where(eq(schema.categories.orgId, orgId)).orderBy(asc(schema.categories.sortOrder))
  return rows.map(toCategory)
}
/** How many events reference each category in an org → { categoryId: count }. Feeds the
 *  Settings → Calendars category list's per-row event-count badge. */
export async function categoryEventCounts(orgId: string): Promise<Record<string, number>> {
  const rows = await db.select({ categoryId: schema.events.categoryId })
    .from(schema.events).where(eq(schema.events.orgId, orgId))
  const out: Record<string, number> = {}
  for (const r of rows) {
    const id = r.categoryId
    if (!id) continue
    out[id] = (out[id] ?? 0) + 1
  }
  return out
}
export async function createCategory(input: EventCategoryCreate): Promise<EventCategory> {
  const id = randomUUID()
  await db.insert(schema.categories).values({
    id, orgId: input.orgId, parentId: input.parentId ?? null, name: input.name,
    color: input.color ?? null, icon: input.icon ?? null, defaultTc: input.defaultTc ?? null,
    defaultFormId: input.defaultFormId ?? null, defaultXeroCodes: input.defaultXeroCodes ?? null,
    defaultDisciplineId: input.defaultDisciplineId ?? null,
    accessTypeKeys: (input.accessTypeKeys && input.accessTypeKeys.length) ? input.accessTypeKeys : null,
    accessPersonIds: (input.accessPersonIds && input.accessPersonIds.length) ? input.accessPersonIds : null,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  const [r] = await db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1)
  return toCategory(r)
}
export async function updateCategory(id: string, patch: EventCategoryPatch): Promise<EventCategory | null> {
  const set: Record<string, any> = { updatedAt: new Date() }
  if (patch.parentId !== undefined) set.parentId = patch.parentId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.color !== undefined) set.color = patch.color
  if (patch.icon !== undefined) set.icon = patch.icon
  if (patch.defaultTc !== undefined) set.defaultTc = patch.defaultTc
  if (patch.defaultFormId !== undefined) set.defaultFormId = patch.defaultFormId
  if (patch.defaultXeroCodes !== undefined) set.defaultXeroCodes = patch.defaultXeroCodes
  if (patch.defaultDisciplineId !== undefined) set.defaultDisciplineId = patch.defaultDisciplineId
  if (patch.accessTypeKeys !== undefined) set.accessTypeKeys = (patch.accessTypeKeys && patch.accessTypeKeys.length) ? patch.accessTypeKeys : null
  if (patch.accessPersonIds !== undefined) set.accessPersonIds = (patch.accessPersonIds && patch.accessPersonIds.length) ? patch.accessPersonIds : null
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  await db.update(schema.categories).set(set).where(eq(schema.categories.id, id))
  const [r] = await db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1)
  return r ? toCategory(r) : null
}
export async function deleteCategory(id: string): Promise<void> {
  await db.delete(schema.categories).where(eq(schema.categories.id, id))
}

// NB: calendars + calendar_categories reads/writes are owned by the WAITLISTS domain
// seam (server/db/repositories/waitlists.ts, useWaitlistsApi). Not duplicated here —
// calendar WRITES are a reported cross-domain gap.

// ── Ticket types ──
function toTicket(r: typeof schema.ticketTypes.$inferSelect): TicketType {
  return {
    id: r.id, eventId: r.eventId, sessionId: r.sessionId ?? null, name: r.name,
    description: r.description ?? null, price: r.price, capacity: r.capacity ?? null,
    sortOrder: r.sortOrder, salesOpenAt: toIso(r.salesOpenAt), salesCloseAt: toIso(r.salesCloseAt),
    isActive: r.isActive,
  }
}
export async function listTicketTypes(eventId: string): Promise<TicketType[]> {
  const rows = await db.select().from(schema.ticketTypes)
    .where(eq(schema.ticketTypes.eventId, eventId)).orderBy(asc(schema.ticketTypes.sortOrder))
  return rows.map(toTicket)
}
export async function createTicketType(input: TicketTypeCreate): Promise<TicketType> {
  const id = randomUUID()
  await db.insert(schema.ticketTypes).values({
    id, eventId: input.eventId, sessionId: input.sessionId ?? null, name: input.name,
    description: input.description ?? null, price: (input.price as any) ?? 0,
    capacity: input.capacity ?? null, sortOrder: input.sortOrder ?? 0,
    salesOpenAt: input.salesOpenAt ? new Date(input.salesOpenAt) : null,
    salesCloseAt: input.salesCloseAt ? new Date(input.salesCloseAt) : null,
    isActive: input.isActive ?? true,
  } as any)
  const [r] = await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.id, id)).limit(1)
  return toTicket(r)
}
export async function updateTicketType(id: string, patch: TicketTypePatch): Promise<TicketType | null> {
  const set: Record<string, any> = {}
  if (patch.sessionId !== undefined) set.sessionId = patch.sessionId
  if (patch.name !== undefined) set.name = patch.name
  if (patch.description !== undefined) set.description = patch.description
  if (patch.price !== undefined) set.price = patch.price
  if (patch.capacity !== undefined) set.capacity = patch.capacity
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.salesOpenAt !== undefined) set.salesOpenAt = patch.salesOpenAt ? new Date(patch.salesOpenAt) : null
  if (patch.salesCloseAt !== undefined) set.salesCloseAt = patch.salesCloseAt ? new Date(patch.salesCloseAt) : null
  if (patch.isActive !== undefined) set.isActive = patch.isActive
  if (Object.keys(set).length) await db.update(schema.ticketTypes).set(set).where(eq(schema.ticketTypes.id, id))
  const [r] = await db.select().from(schema.ticketTypes).where(eq(schema.ticketTypes.id, id)).limit(1)
  return r ? toTicket(r) : null
}
export async function deleteTicketType(id: string): Promise<void> {
  await db.delete(schema.ticketTypes).where(eq(schema.ticketTypes.id, id))
}

// ── Connection groups (saved invitee sets) ──
export async function listConnectionGroups(orgId: string): Promise<ConnectionGroup[]> {
  const rows = await db.select().from(schema.connectionGroups)
    .where(eq(schema.connectionGroups.orgId, orgId)).orderBy(asc(schema.connectionGroups.name))
  return rows.map((r) => ({ id: r.id, orgId: r.orgId, name: r.name }))
}
export async function listConnectionGroupEventIds(groupId: string): Promise<string[]> {
  const rows = await db.select().from(schema.connectionGroupEvents)
    .where(eq(schema.connectionGroupEvents.groupId, groupId))
  return rows.map((r) => r.eventId)
}
export async function createConnectionGroup(input: { orgId: string; name: string }): Promise<ConnectionGroup> {
  const id = randomUUID()
  await db.insert(schema.connectionGroups).values({ id, orgId: input.orgId, name: input.name } as any)
  return { id, orgId: input.orgId, name: input.name }
}
export async function setConnectionGroupEvents(groupId: string, eventIds: string[]): Promise<void> {
  await db.delete(schema.connectionGroupEvents).where(eq(schema.connectionGroupEvents.groupId, groupId))
  for (const eventId of eventIds) {
    await db.insert(schema.connectionGroupEvents).values({ groupId, eventId } as any)
  }
}
export async function deleteConnectionGroup(id: string): Promise<void> {
  await db.delete(schema.connectionGroupEvents).where(eq(schema.connectionGroupEvents.groupId, id))
  await db.delete(schema.connectionGroups).where(eq(schema.connectionGroups.id, id))
}

// ── Recurrence series (events linked by recurrence_parent_id) ──
// A recurring event = one master row + N child rows whose recurrence_parent_id points
// at the master. These power the "Generate series" + series-archive (this/following/all)
// flows in the event editor.

/** How many child occurrences a master currently has. */
export async function countSeries(masterId: string): Promise<number> {
  const rows = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(eq(schema.events.recurrenceParentId, masterId))
  return rows.length
}

/**
 * The whole series as lightweight rows — the master (id = parentId) PLUS every child
 * (recurrence_parent_id = parentId), id + start date + status. The archive flow filters
 * these by start date (following) or takes them all (all).
 */
export async function listSeries(parentId: string): Promise<SeriesEvent[]> {
  const rows = await db
    .select({ id: schema.events.id, startAt: schema.events.startAt, status: schema.events.status })
    .from(schema.events)
    .where(or(eq(schema.events.id, parentId), eq(schema.events.recurrenceParentId, parentId)))
  return rows.map((r) => ({ id: r.id, startAt: toIso(r.startAt), status: r.status }))
}

/** Delete every child occurrence of a master (used before regenerating a series). */
export async function deleteSeriesChildren(masterId: string): Promise<void> {
  await db.delete(schema.events).where(eq(schema.events.recurrenceParentId, masterId))
}

/**
 * Regenerate a master's child occurrences. Clones the master row server-side (so the
 * client never has to ship the whole event shape), stripping id/timestamps/recurrence
 * fields, then delete-then-inserts one child per supplied {startAt,endAt}. Returns the
 * new child count.
 */
export async function generateSeriesOccurrences(
  masterId: string,
  occurrences: { startAt: string; endAt: string | null }[],
): Promise<number> {
  const [master] = await db.select().from(schema.events).where(eq(schema.events.id, masterId)).limit(1)
  if (!master) throw new Error('master event not found')
  // Everything worth cloning except the row identity, timestamps, and the recurrence
  // fields (children are single occurrences: no rule, no exdates, own parent).
  const { id: _id, createdAt: _c, updatedAt: _u, recurrenceRule: _rr, recurrenceParentId: _rp, exdates: _ex, ...cloneable } = master as any
  await deleteSeriesChildren(masterId)
  for (const occ of occurrences) {
    await db.insert(schema.events).values({
      ...cloneable,
      id: randomUUID(),
      recurrenceParentId: masterId,
      recurrenceRule: null,
      exdates: [],
      startAt: occ.startAt ? new Date(occ.startAt) : null,
      endAt: occ.endAt ? new Date(occ.endAt) : null,
    } as any)
  }
  return occurrences.length
}

/**
 * Bulk-set the status of a SET of events — org-scoped in the WHERE (tenant safety), so
 * a stray id can never touch another org's rows. Backs series archive (this/following/all).
 */
export async function setEventsStatus(orgId: string, ids: string[], status: string): Promise<void> {
  if (!ids.length) return
  await db
    .update(schema.events)
    .set({ status })
    .where(and(eq(schema.events.orgId, orgId), inArray(schema.events.id, ids)))
}

// ── Training-event generation (attendance seam write) ──
// Turn a set of groups' weekly training schedules into recurrence master + child
// events, pre-inviting each group's members. Reads the schedules / group names / the
// already-linked schedule ids itself (idempotency: a schedule with a master event is
// skipped) — cross-table reads within a repo are the established pattern (this file
// already joins persons + ticket_types). The recurrence is weekly-only by
// construction, so it's expanded inline (no general rrule engine needed). Consumed by
// useTermRollover.generateTrainingEvents + the group page's createAttendanceEvent.
export async function generateTrainingEvents(input: GenerateTrainingInput): Promise<GenerateTrainingResult> {
  const { orgId, groupIds, window } = input
  if (!groupIds.length || !window.start || !window.end) return { events: 0, classes: 0 }
  const membersByGroup = input.membersByGroup ?? {}

  const scheds = await db
    .select()
    .from(schema.memberGroupSchedules)
    .where(inArray(schema.memberGroupSchedules.groupId, groupIds))
    .orderBy(asc(schema.memberGroupSchedules.sortOrder))
  // Schedules already turned into an event (member_group_schedule_id lives ONLY on the
  // master) — skip them so a re-run never double-creates.
  const linkedRows = await db
    .select({ sid: schema.events.memberGroupScheduleId })
    .from(schema.events)
    .where(and(inArray(schema.events.memberGroupId, groupIds), isNotNull(schema.events.memberGroupScheduleId)))
  const alreadyLinked = new Set(linkedRows.map((r) => r.sid).filter(Boolean) as string[])
  const groupRows = await db
    .select({ id: schema.memberGroups.id, name: schema.memberGroups.name })
    .from(schema.memberGroups)
    .where(inArray(schema.memberGroups.id, groupIds))
  const nameById: Record<string, string> = Object.fromEntries(groupRows.map((g) => [g.id, g.name]))

  const [sy, sm, sd] = window.start.split('-').map(Number)
  const [ey, em, ed] = window.end.split('-').map(Number)
  const winStart = new Date(sy!, (sm ?? 1) - 1, sd ?? 1)
  const winEnd = new Date(ey!, (em ?? 1) - 1, ed ?? 1, 23, 59, 59)
  const byDayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const untilStr = `${window.end.replace(/-/g, '')}T235959Z`

  let eventCount = 0
  const touched = new Set<string>()

  for (const sched of scheds) {
    if (alreadyLinked.has(sched.id)) continue
    // First occurrence on/after the window start on the schedule's weekday.
    const first = new Date(winStart)
    while (first.getDay() !== sched.dayOfWeek) first.setDate(first.getDate() + 1)
    if (first > winEnd) continue

    const loc = asObj(sched.location) || {}
    const [sh, smin] = String(sched.startTime || '0:0').split(':').map(Number)
    const [eh, emin] = String(sched.endTime || '0:0').split(':').map(Number)
    const masterStart = new Date(first.getFullYear(), first.getMonth(), first.getDate(), sh ?? 0, smin ?? 0)
    const masterEnd = new Date(first.getFullYear(), first.getMonth(), first.getDate(), eh ?? 0, emin ?? 0)
    const duration = masterEnd.getTime() - masterStart.getTime()
    const rrule = `FREQ=WEEKLY;BYDAY=${byDayCodes[sched.dayOfWeek]};UNTIL=${untilStr}`
    const groupName = nameById[sched.groupId] ?? 'Class'
    const schedName = sched.name ? String(sched.name).trim() : ''

    const shared = {
      orgId,
      title: schedName
        ? `${groupName} — ${schedName}`
        : `${groupName} — ${dayNames[sched.dayOfWeek]} Training`,
      style: 'BASIC',
      status: 'DRAFT',
      memberGroupId: sched.groupId,
      locationType: loc.type ?? 'ADDRESS',
      bookableId: loc.type === 'BOOKABLE' ? (loc.bookable_ids?.[0] ?? null) : null,
      address: loc.type === 'ADDRESS' ? ([loc.venue_name, loc.address].filter(Boolean).join(', ') || null) : null,
      meetingLink: loc.type === 'ONLINE' ? (loc.meeting_link || null) : null,
    } as const

    // Master via createEvent so every notNull column gets its default; the schedule
    // pointer lives on the master alone.
    const master = await createEvent({
      ...shared,
      memberGroupScheduleId: sched.id,
      startAt: masterStart.toISOString(),
      endAt: masterEnd.toISOString(),
      recurrenceRule: rrule,
    } as any)

    // Children: clone the persisted master row (already has every column filled),
    // stripping identity/timestamps/recurrence + the schedule pointer (children don't
    // carry it), and re-time each to its weekly occurrence. Batched insert.
    const [masterRow] = await db.select().from(schema.events).where(eq(schema.events.id, master.id)).limit(1)
    const { id: _id, createdAt: _c, updatedAt: _u, recurrenceRule: _rr, recurrenceParentId: _rp, memberGroupScheduleId: _ms, exdates: _ex, ...cloneable } = masterRow as any
    const childValues: any[] = []
    for (let d = new Date(masterStart); d <= winEnd; d.setDate(d.getDate() + 7)) {
      // The master already IS the first occurrence — skip it.
      if (d.getTime() === masterStart.getTime()) continue
      const childStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), sh ?? 0, smin ?? 0)
      childValues.push({
        ...cloneable,
        id: randomUUID(),
        recurrenceParentId: master.id,
        recurrenceRule: null,
        memberGroupScheduleId: null,
        exdates: [],
        startAt: childStart,
        endAt: new Date(childStart.getTime() + duration),
      })
    }
    if (childValues.length) await db.insert(schema.events).values(childValues as any)
    const eventIds = [master.id, ...childValues.map((c) => c.id)]

    // Pre-invite every member to every occurrence (one batched insert). The client
    // resolved the staff-filtered member list per group.
    const people = membersByGroup[sched.groupId] ?? []
    if (people.length) {
      const inviteeRows: any[] = []
      for (const eid of eventIds) {
        for (const pid of people) {
          inviteeRows.push({
            id: randomUUID(),
            eventId: eid,
            personId: pid,
            status: 'INVITED',
            attended: false,
            signedOut: false,
            roles: [],
          })
        }
      }
      if (inviteeRows.length) await db.insert(schema.invitees).values(inviteeRows as any)
    }
    eventCount += eventIds.length
    touched.add(sched.groupId)
  }
  return { events: eventCount, classes: touched.size }
}

// ── Event communications (the SEND log) ──
// The `communications` table is keyed by event with no status column (a stored row is
// 'SENT') and no channel/scheduled_at columns. Reads/creates the per-event message log
// the event Communication tab shows + writes.
function toEventCommunication(r: typeof schema.communications.$inferSelect): EventCommunication {
  return {
    id: r.id,
    eventId: r.eventId,
    subject: r.subject,
    body: r.body,
    recipientCount: r.recipientCount,
    status: 'SENT',
    sentAt: toIso(r.sentAt),
  }
}

/** Every message sent for an event, newest first. */
export async function listCommunicationsForEvent(eventId: string): Promise<EventCommunication[]> {
  const rows = await db
    .select()
    .from(schema.communications)
    .where(eq(schema.communications.eventId, eventId))
    .orderBy(desc(schema.communications.sentAt))
  return rows.map(toEventCommunication)
}

/** Record a sent message against an event (the honest send row: real recipientCount). */
export async function createCommunication(
  input: EventCommunicationCreate & { eventId: string },
): Promise<EventCommunication> {
  const id = randomUUID()
  await db.insert(schema.communications).values({
    id,
    eventId: input.eventId,
    subject: input.subject,
    body: input.body,
    recipientCount: input.recipientCount ?? 0,
    audienceFilter: input.audienceFilter ?? null,
    sentBy: input.sentBy ?? null,
  } as any)
  const [r] = await db.select().from(schema.communications).where(eq(schema.communications.id, id)).limit(1)
  return toEventCommunication(r)
}

// ── Event disciplines (link table for DisciplineLinker) ──
export async function listEventDisciplineIds(eventId: string): Promise<string[]> {
  const rows = await db.select().from(schema.eventDisciplines)
    .where(eq(schema.eventDisciplines.eventId, eventId))
  return rows.map((r) => r.disciplineId)
}
export async function setEventDisciplines(eventId: string, disciplineIds: string[]): Promise<void> {
  await db.delete(schema.eventDisciplines).where(eq(schema.eventDisciplines.eventId, eventId))
  for (const disciplineId of disciplineIds) {
    await db.insert(schema.eventDisciplines).values({ eventId, disciplineId } as any)
  }
}
