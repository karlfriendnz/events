// The CONTRACT for the events domain: Zod schemas + the domain types inferred from
// them, shared by the client (typed composable) and the server (Nitro route output
// validation). DB-neutral by design — the array/object columns (exdates, roles,
// addons, form_answers) are `json` in MySQL today, were Postgres arrays/jsonb
// before, and could be anything behind a future API; the UI only ever sees plain
// string[] / arrays / objects, and only the repository mapper knows the storage.
//
// Timestamps travel as ISO 8601 strings (the transport form). The DB stores a
// timestamp; the repo serialises with toIso (Date→toISOString, null passes through)
// — so a nullable start/end date arrives as `string | null`.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A club event — a one-off, a recurring series master/child, or a programme.
export const fmEventSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  // Open string sets (validated here, not by a DB CHECK): 'BASIC', 'PUBLISHED', …
  style: z.string(),
  status: z.string(),
  // Nullable in the schema — an undated event parks on today in the staff calendar.
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  isPublic: z.boolean(),
  isProgramme: z.boolean(),
  formId: z.string().nullable(),
  memberGroupId: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryIds: z.array(z.string()).nullable(),
  bannerUrl: z.string().nullable(),
  // Event-level location (mig: events carry location directly, e.g. group-training
  // events). locationType is a required DB column (open set ADDRESS/BOOKABLE/ONLINE);
  // address is nullable. Surfaced so the dashboard/forms can show an event's venue
  // without loading its sessions. (cross-domain gap Fo7/D1)
  locationType: z.string(),
  bookableId: z.string().nullable(),
  address: z.string().nullable(),
  meetingLink: z.string().nullable(),
  // json array of location entries (multi-venue). Passthrough at the boundary.
  locations: z.any().nullable(),
  ageMin: z.number().int().nullable(),
  ageMax: z.number().int().nullable(),
  genderRestriction: z.string().nullable(),
  // Who can see this event: public | internal | all_members | custom (null = internal).
  // For custom, the arrays name the extra audience (people type / person / group).
  visibility: z.string().nullable(),
  visibilityTypeKeys: z.array(z.string()).nullable(),
  visibilityPersonIds: z.array(z.string()).nullable(),
  visibilityGroupIds: z.array(z.string()).nullable(),
  recurrenceRule: z.string().nullable(),
  recurrenceParentId: z.string().nullable(),
  createdVia: z.string().nullable(),
  // json array of YYYY-MM-DD skip-dates. Empty when none.
  exdates: z.array(z.string()),
  // ── The full editor surface (the create wizards + /events/:id write these) ──
  isAllDay: z.boolean(),
  secondaryCategoryId: z.string().nullable(),
  capacityMin: z.number().int().nullable(),
  capacityMax: z.number().int().nullable(),
  showAttendeeList: z.boolean(),
  showAttendeeCount: z.boolean(),
  allowInterest: z.boolean(),
  allowGuests: z.boolean(),
  maxGuestsPerInvitee: z.number().int().nullable(),
  holdSpotEnabled: z.boolean(),
  holdSpotAgeMax: z.number().int().nullable(),
  phasedRegistration: z.boolean(),
  memberWindowDays: z.number().int(),
  publicOpensAt: z.string().nullable(),
  masterEventId: z.string().nullable(),
  isFeatured: z.boolean(),
  publicUrlSlug: z.string().nullable(),
  tcContent: z.string().nullable(),
  hasWaitlist: z.boolean(),
  hasTickets: z.boolean(),
  regOpenAt: z.string().nullable(),
  regCloseAt: z.string().nullable(),
  publishAt: z.string().nullable(),
  notes: z.string().nullable(),
  hideBanner: z.boolean(),
  xeroCodesLocked: z.boolean(),
  memberGroupScheduleId: z.string().nullable(),
  // json blobs — passthrough at the boundary.
  attachments: z.any().nullable(),
  subGroups: z.any().nullable(),
  sharingConfig: z.any().nullable(),
  automation: z.any().nullable(),
  invitationEmail: z.any().nullable(),
})
export type FMEvent = z.infer<typeof fmEventSchema>

// An event SHARED to a club (accepted event_org_invitee) — a normal event plus who
// shared it and the discipline scope. Read-only on the club side.
export const sharedEventSchema = fmEventSchema.extend({
  sharedFromOrgName: z.string().nullable(),
  disciplineName: z.string().nullable(),
})
export type SharedEvent = z.infer<typeof sharedEventSchema>
export const sharedEventListSchema = z.array(sharedEventSchema)

export const fmEventListSchema = z.array(fmEventSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it) and
// makes everything but orgId + title optional — the repo/DB supply the rest.
// Update is a partial: any subset of the writable fields.
export const fmEventCreateSchema = fmEventSchema
  .omit({ id: true })
  .partial({
    description: true, style: true, status: true, startAt: true, endAt: true,
    isPublic: true, isProgramme: true, formId: true, memberGroupId: true,
    categoryId: true, categoryIds: true, bannerUrl: true, locationType: true, bookableId: true,
    address: true, meetingLink: true, locations: true, ageMin: true, ageMax: true,
    genderRestriction: true,
    visibility: true, visibilityTypeKeys: true, visibilityPersonIds: true, visibilityGroupIds: true,
    recurrenceRule: true, recurrenceParentId: true, createdVia: true, exdates: true,
    isAllDay: true, secondaryCategoryId: true, capacityMin: true, capacityMax: true,
    showAttendeeList: true, showAttendeeCount: true, allowInterest: true, allowGuests: true,
    maxGuestsPerInvitee: true, holdSpotEnabled: true, holdSpotAgeMax: true,
    phasedRegistration: true, memberWindowDays: true, publicOpensAt: true,
    masterEventId: true, isFeatured: true, publicUrlSlug: true, tcContent: true,
    hasWaitlist: true, hasTickets: true, regOpenAt: true, regCloseAt: true,
    publishAt: true, notes: true, hideBanner: true, xeroCodesLocked: true,
    memberGroupScheduleId: true, attachments: true, subGroups: true,
    sharingConfig: true, automation: true, invitationEmail: true,
  })
  .extend({ title: z.string().min(1) })
export type FMEventCreate = z.infer<typeof fmEventCreateSchema>

export const fmEventPatchSchema = fmEventCreateSchema.partial()
export type FMEventPatch = z.infer<typeof fmEventPatchSchema>

// One occurrence of an event. NB: the `sessions` table has no `status` column
// (session lifecycle is carried elsewhere) — status is exposed as nullable for
// contract stability and mapped to null. start/end are nullable in the schema.
//
// This is the FULL session-editor surface. Beyond the forms-builder subset the read
// shape also carries every column /events/:id?tab=sessions reads AND writes:
// parentSessionId (sub-sessions), description, bookableId, capacityMin, isAllDay,
// hasWaitlist, showAttendeeList, showAsSeparateEvent, the invitee/eligibility/admins
// json blobs, and exdates. Routing session writes through createSession/updateSession
// without these would silently DROP them (Zod strips unknown keys) and break
// sub-sessions + master→linked inheritance. (NEW gap — the mega-file sessions editor.)
export const sessionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  // null = a top-level session (master or standalone); set = a sub-session under it.
  parentSessionId: z.string().nullable(),
  // The session's own name — a required DB column; now surfaced on the read shape so
  // the forms builder / programme date table can label each occurrence. (gap Fo8)
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  status: z.string().nullable(),
  capacityMin: z.number().int().nullable(),
  capacityMax: z.number().int().nullable(),
  locationType: z.string(),
  bookableId: z.string().nullable(),
  address: z.string().nullable(),
  meetingLink: z.string().nullable(),
  // Whether this session is mandatory + whether it appears on the registration form,
  // plus its author order — all read by the forms builder. (gap Fo8)
  isRequired: z.boolean(),
  displayOnForm: z.boolean(),
  isPublic: z.boolean(),
  isAllDay: z.boolean(),
  hasWaitlist: z.boolean(),
  showAttendeeList: z.boolean(),
  showAsSeparateEvent: z.boolean(),
  // 'regular' | 'pre_event' | 'post_event' — a required DB column (default 'regular').
  sessionKind: z.string(),
  sortOrder: z.number().int(),
  isMaster: z.boolean(),
  masterId: z.string().nullable(),
  // json blobs — passthrough at the boundary (the editor mutates them in memory).
  inviteeModes: z.any().nullable(),
  inviteeGroups: z.any().nullable(),
  eligibility: z.any().nullable(),
  admins: z.array(z.any()),
  // json array of add-on definitions + json array of YYYY-MM-DD skip-dates.
  addons: z.array(z.any()),
  exdates: z.array(z.string()),
})
export type Session = z.infer<typeof sessionSchema>

export const sessionListSchema = z.array(sessionSchema)

// A separate-session calendar item: a full session plus a small slice of its parent
// event (the events board renders show_as_separate_event sessions as their own items).
export const separateSessionSchema = sessionSchema.extend({
  event: z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    orgId: z.string(),
    categoryId: z.string().nullable(),
    isProgramme: z.boolean(),
  }).nullable(),
})
export type SeparateSession = z.infer<typeof separateSessionSchema>
export const separateSessionListSchema = z.array(separateSessionSchema)

// WRITE contracts for a session. Create omits the server-owned id and the
// always-null `status` (no column), requires eventId + a title (title is a
// required DB column not surfaced on the read shape), and defaults the rest.
export const sessionCreateSchema = sessionSchema
  .omit({ id: true, status: true })
  .partial({
    parentSessionId: true, description: true, startAt: true, endAt: true,
    capacityMin: true, capacityMax: true, locationType: true, bookableId: true,
    address: true, meetingLink: true, isRequired: true, displayOnForm: true,
    isPublic: true, isAllDay: true, hasWaitlist: true, showAttendeeList: true,
    showAsSeparateEvent: true, sessionKind: true, sortOrder: true, isMaster: true,
    masterId: true, inviteeModes: true, inviteeGroups: true, eligibility: true,
    admins: true, addons: true, exdates: true,
  })
  .extend({ title: z.string().min(1) })
export type SessionCreate = z.infer<typeof sessionCreateSchema>

export const sessionPatchSchema = sessionCreateSchema.partial()
export type SessionPatch = z.infer<typeof sessionPatchSchema>

// An invited person on an event — the answer to "are you coming" lives in `status`
// (CONFIRMED/DECLINED/INVITED…). `roles` is a json array of scoped-role keys.
// subGroupId (attendance sub-group assignment), signedOut (attendance sign-out) and
// invitedAt (invite order) are all read + written by the Invitees + Attendance UI.
export const inviteeSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  sessionId: z.string().nullable(),
  personId: z.string().nullable(),
  status: z.string(),
  roles: z.array(z.string()),
  role: z.string().nullable(),
  attended: z.boolean(),
  signedOut: z.boolean(),
  subGroupId: z.string().nullable(),
  invitedAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  // When the invitation email was actually SENT (distinct from invitedAt = merely
  // ADDED) — the invitation dialog counts already-emailed invitees off this.
  inviteSentAt: z.string().nullable(),
  // The club that added this invitee (null = the event owner's own). Scopes a shared
  // event's invitees per club.
  clubOrgId: z.string().nullable().optional(),
})
export type Invitee = z.infer<typeof inviteeSchema>

export const inviteeListSchema = z.array(inviteeSchema)

// An invitee row enriched with the joined person (first/last/email/dob) — the shape
// the Invitees + Attendance tabs actually render (name search, sub-groups, ages).
// The person block is nullable because an invitee can be a guest without a persons row.
export const inviteeWithPersonSchema = inviteeSchema.extend({
  person: z
    .object({
      id: z.string(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
      email: z.string().nullable(),
      dateOfBirth: z.string().nullable(),
      gender: z.string().nullable(),
      photoUrl: z.string().nullable(),
      phone: z.string().nullable(),
      phone2: z.string().nullable(),
      membershipType: z.string().nullable(),
      customFields: z.record(z.string(), z.any()).nullable(),
    })
    .nullable(),
})
export type InviteeWithPerson = z.infer<typeof inviteeWithPersonSchema>
export const inviteeWithPersonListSchema = z.array(inviteeWithPersonSchema)

// A registration against an event. Money columns are MySQL decimals → strings from
// the driver, so amounts accept string | number at the boundary. guestName/guestEmail
// (a registrant with no persons row) + createdAt are read by the reporting tab
// (recent-registrations sort/display). ticketId flags a ticket-order registration.
export const registrationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  personId: z.string().nullable(),
  guestName: z.string().nullable(),
  guestEmail: z.string().nullable(),
  status: z.string(),
  ticketId: z.string().nullable(),
  totalAmount: z.union([z.string(), z.number()]),
  paidAmount: z.union([z.string(), z.number()]),
  // json payload — the full normalised answer set; passthrough at the boundary.
  formAnswers: z.any().nullable(),
  checkedInAt: z.string().nullable(),
  createdAt: z.string().nullable(),
})
export type Registration = z.infer<typeof registrationSchema>

export const registrationListSchema = z.array(registrationSchema)

// A ticket-order registration: the registration + its nested ticket line-items, each
// carrying the ticket-type's name (a registration_ticket_items → ticket_types join).
// The tickets tab's "orders" read. Amounts are decimals → string|number.
export const ticketOrderItemSchema = z.object({
  id: z.string(),
  quantity: z.number().int(),
  unitPrice: z.union([z.string(), z.number()]),
  subtotal: z.union([z.string(), z.number()]),
  ticketTypeName: z.string(),
})
export const ticketOrderSchema = z.object({
  id: z.string(),
  guestName: z.string().nullable(),
  guestEmail: z.string().nullable(),
  status: z.string(),
  ticketId: z.string().nullable(),
  totalAmount: z.union([z.string(), z.number()]),
  checkedInAt: z.string().nullable(),
  items: z.array(ticketOrderItemSchema),
})
export type TicketOrder = z.infer<typeof ticketOrderSchema>
export const ticketOrderListSchema = z.array(ticketOrderSchema)

// An invitee row read BY PERSON (across events) for the profile activity feed. A bare
// invitee list is useless without event context, so this joins the event's title +
// start date onto each row. (cross-domain gap D9)
export const inviteeForPersonSchema = inviteeSchema.extend({
  eventTitle: z.string(),
  eventStartAt: z.string().nullable(),
  eventStatus: z.string(),
})
export type InviteeForPerson = z.infer<typeof inviteeForPersonSchema>

export const inviteeForPersonListSchema = z.array(inviteeForPersonSchema)

// ── Event org (club) invitees ──
// Inviting a whole affiliated CLUB to an event (governing-org "Clubs" tab). A club
// invitee is neither a person nor a group — kept first-class so "this club is
// invited" is a stored fact, not a fan-out. (migration 280 / mysql 0004)
// The three things a club can choose to connect from an event once it accepts.
// `communication` is a TEMPLATE flag (surfaces the event's comms template — it does
// not itself send anything).
export const eventConnectionsSchema = z.object({
  event_details: z.boolean().optional(),
  fees: z.boolean().optional(),
  communication: z.boolean().optional(),
}).nullable()
export type EventConnections = z.infer<typeof eventConnectionsSchema>

export const eventOrgInviteeSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  orgId: z.string(),
  invitedByOrgId: z.string().nullable(),
  status: z.string(),
  connections: eventConnectionsSchema.optional(),
  disciplineId: z.string().nullable().optional(),
  invitedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
})
export type EventOrgInvitee = z.infer<typeof eventOrgInviteeSchema>
export const eventOrgInviteeWithNameSchema = eventOrgInviteeSchema.extend({ orgName: z.string().nullable(), disciplineName: z.string().nullable().optional() })
export type EventOrgInviteeWithName = z.infer<typeof eventOrgInviteeWithNameSchema>
export const eventOrgInviteeListSchema = z.array(eventOrgInviteeWithNameSchema)

// The club-side view of an invitation: the invite + the event it's for + who sent it,
// so the invited club can render "{Body} invited you to {Event}" and accept/decline.
export const eventOrgInviteForClubSchema = eventOrgInviteeSchema.extend({
  eventTitle: z.string().nullable(),
  eventStartAt: z.string().nullable(),
  eventBannerUrl: z.string().nullable(),
  eventDescription: z.string().nullable(),
  eventStatus: z.string().nullable(),
  invitedByOrgName: z.string().nullable(),
  disciplineName: z.string().nullable(),
})
export type EventOrgInviteForClub = z.infer<typeof eventOrgInviteForClubSchema>
export const eventOrgInviteForClubListSchema = z.array(eventOrgInviteForClubSchema)

// ── Calendar org (club) invitees — a whole CALENDAR shared to an affiliated club ──
// Same handshake as an event invite, one level up: accept → every event on that
// calendar (resolved by its category set) shows read-only on the club's calendar.
export const calendarOrgInviteeSchema = z.object({
  id: z.string(),
  calendarId: z.string(),
  orgId: z.string(),
  invitedByOrgId: z.string().nullable(),
  status: z.string(),
  connections: eventConnectionsSchema.optional(),
  invitedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  decidedAt: z.string().nullable(),
})
export type CalendarOrgInvitee = z.infer<typeof calendarOrgInviteeSchema>
export const calendarOrgInviteeWithNameSchema = calendarOrgInviteeSchema.extend({ orgName: z.string().nullable(), calendarName: z.string().nullable() })
export type CalendarOrgInviteeWithName = z.infer<typeof calendarOrgInviteeWithNameSchema>
export const calendarOrgInviteeListSchema = z.array(calendarOrgInviteeWithNameSchema)

// The club-side view: the invite + which calendar + who shared it (for the inbox card).
export const calendarOrgInviteForClubSchema = calendarOrgInviteeSchema.extend({
  calendarName: z.string().nullable(),
  calendarColor: z.string().nullable(),
  calendarIcon: z.string().nullable(),
  invitedByOrgName: z.string().nullable(),
})
export type CalendarOrgInviteForClub = z.infer<typeof calendarOrgInviteForClubSchema>
export const calendarOrgInviteForClubListSchema = z.array(calendarOrgInviteForClubSchema)

// ── Fee components ──
// A named fee line on an event OR a session (exactly one of eventId/sessionId is set;
// session fees are keyed by session_id, NOT event_id). Decimal money → string|number.
export const feeComponentSchema = z.object({
  id: z.string(),
  eventId: z.string().nullable(),
  sessionId: z.string().nullable(),
  name: z.string(),
  amount: z.union([z.string(), z.number()]),
  xeroCode: z.string().nullable(),
  isLocked: z.boolean(),
  depositPercent: z.union([z.string(), z.number()]).nullable(),
  sortOrder: z.number().int(),
})
export type FeeComponent = z.infer<typeof feeComponentSchema>
export const feeComponentListSchema = z.array(feeComponentSchema)
export const feeComponentCreateSchema = feeComponentSchema.omit({ id: true }).partial({
  eventId: true, sessionId: true, xeroCode: true, isLocked: true,
  depositPercent: true, sortOrder: true,
})
export type FeeComponentCreate = z.infer<typeof feeComponentCreateSchema>
export const feeComponentPatchSchema = feeComponentCreateSchema.partial()
export type FeeComponentPatch = z.infer<typeof feeComponentPatchSchema>

// ── Event notes ──
export const eventNoteSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  title: z.string().nullable(),
  content: z.string(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})
export type EventNote = z.infer<typeof eventNoteSchema>
export const eventNoteListSchema = z.array(eventNoteSchema)
export const eventNoteCreateSchema = eventNoteSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial({ title: true })
export type EventNoteCreate = z.infer<typeof eventNoteCreateSchema>
export const eventNotePatchSchema = eventNoteCreateSchema.partial()
export type EventNotePatch = z.infer<typeof eventNotePatchSchema>

// ── Event tasks ──
export const eventTaskSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  text: z.string(),
  done: z.boolean(),
  dueDate: z.string().nullable(),
  assigneeIds: z.array(z.string()),
  isRole: z.boolean(),
  roleCapacity: z.number().int(),
})
export type EventTask = z.infer<typeof eventTaskSchema>
export const eventTaskListSchema = z.array(eventTaskSchema)
export const eventTaskCreateSchema = eventTaskSchema.omit({ id: true }).partial({
  done: true, dueDate: true, assigneeIds: true, isRole: true, roleCapacity: true,
})
export type EventTaskCreate = z.infer<typeof eventTaskCreateSchema>
export const eventTaskPatchSchema = eventTaskCreateSchema.partial()
export type EventTaskPatch = z.infer<typeof eventTaskPatchSchema>

// ── Event categories (org-scoped; nest via parentId) ──
export const eventCategorySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  parentId: z.string().nullable(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  defaultTc: z.string().nullable(),
  defaultFormId: z.string().nullable(),
  defaultXeroCodes: z.any().nullable(),
  defaultDisciplineId: z.string().nullable(),   // primary discipline (= disciplineIds[0]) — kept for back-compat
  disciplineIds: z.array(z.string()).nullable(), // all governing-body disciplines this category links to
  // WHO CAN ACCESS — a permission target is a person TYPE or a specific PERSON (the
  // system-wide rule: any access control may name a people type or an individual).
  // Both null/empty = everyone.
  accessTypeKeys: z.array(z.string()).nullable(), // person-type keys who may access it
  accessPersonIds: z.array(z.string()).nullable(), // specific person ids who may access it
  // Default attendee-roll column keys for events in this category (migration 286).
  // Keys match <EventAttendance>'s allColumns (email/phone/roles/age/gender/membership +
  // cf:<id>). null/empty = the roll's own auto defaults.
  defaultColumns: z.array(z.string()).nullable(),
  sortOrder: z.number().int(),
})
export type EventCategory = z.infer<typeof eventCategorySchema>
export const eventCategoryListSchema = z.array(eventCategorySchema)
export const eventCategoryCreateSchema = eventCategorySchema.omit({ id: true }).partial({
  parentId: true, color: true, icon: true, defaultTc: true, defaultFormId: true,
  defaultXeroCodes: true, defaultDisciplineId: true, disciplineIds: true, accessTypeKeys: true, accessPersonIds: true, defaultColumns: true, sortOrder: true,
})
export type EventCategoryCreate = z.infer<typeof eventCategoryCreateSchema>
export const eventCategoryPatchSchema = eventCategoryCreateSchema.partial()
export type EventCategoryPatch = z.infer<typeof eventCategoryPatchSchema>

// NB: calendars + calendar_categories are owned by the WAITLISTS domain seam
// (shared/contracts/waitlist.ts, useWaitlistsApi().calendars). The events pages read
// them via that composable. Calendar WRITES (create/update/delete, pin-to-nav,
// settings, category links) are a reported cross-domain gap — not modelled here.

// ── Ticket types ──
export const ticketTypeSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  sessionId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.union([z.string(), z.number()]),
  capacity: z.number().int().nullable(),
  sortOrder: z.number().int(),
  salesOpenAt: z.string().nullable(),
  salesCloseAt: z.string().nullable(),
  isActive: z.boolean(),
})
export type TicketType = z.infer<typeof ticketTypeSchema>
export const ticketTypeListSchema = z.array(ticketTypeSchema)
export const ticketTypeCreateSchema = ticketTypeSchema.omit({ id: true }).partial({
  sessionId: true, description: true, capacity: true, sortOrder: true,
  salesOpenAt: true, salesCloseAt: true, isActive: true,
})
export type TicketTypeCreate = z.infer<typeof ticketTypeCreateSchema>
export const ticketTypePatchSchema = ticketTypeCreateSchema.partial()
export type TicketTypePatch = z.infer<typeof ticketTypePatchSchema>

// ── Registration sessions (which sessions a registration selected) ──
export const registrationSessionSchema = z.object({
  id: z.string(),
  registrationId: z.string(),
  sessionId: z.string(),
  status: z.string(),
})
export type RegistrationSession = z.infer<typeof registrationSessionSchema>
export const registrationSessionListSchema = z.array(registrationSessionSchema)

// WRITE contract for a registration (event-context materialisation on the client).
// createdAt is server-owned (omit); the rest default in the repo/DB.
export const registrationCreateSchema = registrationSchema.omit({ id: true, createdAt: true }).partial({
  personId: true, guestName: true, guestEmail: true, ticketId: true,
  status: true, totalAmount: true, paidAmount: true,
  formAnswers: true, checkedInAt: true,
})
export type RegistrationCreate = z.infer<typeof registrationCreateSchema>
export const registrationPatchSchema = registrationCreateSchema.partial()
export type RegistrationPatch = z.infer<typeof registrationPatchSchema>

// ── Recurrence series ──
// A lightweight row for a recurring master + its children — id + start date, enough
// for the series-archive scope logic (this / following / all). generateOccurrences
// clones the master server-side, so the child-insert payload isn't modelled here.
export const seriesEventSchema = z.object({
  id: z.string(),
  startAt: z.string().nullable(),
  status: z.string(),
})
export type SeriesEvent = z.infer<typeof seriesEventSchema>
export const seriesEventListSchema = z.array(seriesEventSchema)

// ── Connection groups (saved invitee sets) + their event links ──
export const connectionGroupSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
})
export type ConnectionGroup = z.infer<typeof connectionGroupSchema>
export const connectionGroupListSchema = z.array(connectionGroupSchema)

// ── Training-event generation (attendance seam write) ──
// A group's weekly training schedules become one recurrence master + N weekly child
// events, with every member pre-invited so the attendance tab opens with the roster.
// Both consumers (useTermRollover.generateTrainingEvents + the group page's
// createAttendanceEvent) share this exact pattern; the recurrence math + the
// events/invitees writes live server-side, so the client passes only a compact input.
// Idempotent: a schedule already linked to an event (member_group_schedule_id) is
// skipped. `membersByGroup` is the CLIENT's staff-filtered invitee list per group
// (staff-vs-member detection is scoped-role logic that stays on the client); omit it
// and events are created without invitees. `window` bounds the series (YYYY-MM-DD).
export const generateTrainingInputSchema = z.object({
  orgId: z.string(),
  groupIds: z.array(z.string()).min(1),
  window: z.object({ start: z.string(), end: z.string() }),
  // groupId → the group's staff-filtered invitee person-ids (string keys).
  membersByGroup: z.record(z.array(z.string())).optional(),
})
export type GenerateTrainingInput = z.infer<typeof generateTrainingInputSchema>

// events = total event rows created (masters + children); classes = distinct groups
// that produced at least one event (the "N classes" in the toast).
export const generateTrainingResultSchema = z.object({
  events: z.number().int(),
  classes: z.number().int(),
})
export type GenerateTrainingResult = z.infer<typeof generateTrainingResultSchema>

// ── Event communications (the SEND log) ──
// A message sent to an event's audience. The MySQL `communications` table is keyed by
// event with no status column (a stored row is 'SENT') and no channel/scheduled_at
// columns — those were demo-only UI fields, so a real sent row simply carries no
// channel badge. `sentAt` serialises from the row's timestamp.
export const eventCommunicationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  subject: z.string(),
  body: z.string(),
  recipientCount: z.number().int(),
  status: z.string(),
  sentAt: z.string().nullable(),
})
export type EventCommunication = z.infer<typeof eventCommunicationSchema>
export const eventCommunicationListSchema = z.array(eventCommunicationSchema)

// The SEND write. eventId comes from the route param; the client supplies the message
// + the resolved recipient count (audienceFilter is an optional json record of who).
export const eventCommunicationCreateSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  recipientCount: z.number().int().optional(),
  audienceFilter: z.any().nullable().optional(),
  sentBy: z.string().nullable().optional(),
})
export type EventCommunicationCreate = z.infer<typeof eventCommunicationCreateSchema>
