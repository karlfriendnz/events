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

export const fmEventListSchema = z.array(fmEventSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it) and
// makes everything but orgId + title optional — the repo/DB supply the rest.
// Update is a partial: any subset of the writable fields.
export const fmEventCreateSchema = fmEventSchema
  .omit({ id: true })
  .partial({
    description: true, style: true, status: true, startAt: true, endAt: true,
    isPublic: true, isProgramme: true, formId: true, memberGroupId: true,
    categoryId: true, bannerUrl: true, locationType: true, bookableId: true,
    address: true, meetingLink: true, locations: true, ageMin: true, ageMax: true,
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
export const sessionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  // The session's own name — a required DB column; now surfaced on the read shape so
  // the forms builder / programme date table can label each occurrence. (gap Fo8)
  title: z.string(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  status: z.string().nullable(),
  capacityMax: z.number().int().nullable(),
  locationType: z.string(),
  address: z.string().nullable(),
  meetingLink: z.string().nullable(),
  // Whether this session is mandatory + whether it appears on the registration form,
  // plus its author order — all read by the forms builder. (gap Fo8)
  isRequired: z.boolean(),
  displayOnForm: z.boolean(),
  isPublic: z.boolean(),
  sortOrder: z.number().int(),
  isMaster: z.boolean(),
  masterId: z.string().nullable(),
  // json array of add-on definitions.
  addons: z.array(z.any()),
})
export type Session = z.infer<typeof sessionSchema>

export const sessionListSchema = z.array(sessionSchema)

// WRITE contracts for a session. Create omits the server-owned id and the
// always-null `status` (no column), requires eventId + a title (title is a
// required DB column not surfaced on the read shape), and defaults the rest.
export const sessionCreateSchema = sessionSchema
  .omit({ id: true, status: true })
  .partial({
    startAt: true, endAt: true, capacityMax: true, locationType: true,
    address: true, meetingLink: true, isRequired: true, displayOnForm: true,
    isPublic: true, sortOrder: true, isMaster: true, masterId: true, addons: true,
  })
  .extend({ title: z.string().min(1) })
export type SessionCreate = z.infer<typeof sessionCreateSchema>

export const sessionPatchSchema = sessionCreateSchema.partial()
export type SessionPatch = z.infer<typeof sessionPatchSchema>

// An invited person on an event — the answer to "are you coming" lives in `status`
// (CONFIRMED/DECLINED/INVITED…). `roles` is a json array of scoped-role keys.
export const inviteeSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  personId: z.string().nullable(),
  status: z.string(),
  roles: z.array(z.string()),
  attended: z.boolean(),
  respondedAt: z.string().nullable(),
})
export type Invitee = z.infer<typeof inviteeSchema>

export const inviteeListSchema = z.array(inviteeSchema)

// A registration against an event. Money columns are MySQL decimals → strings from
// the driver, so amounts accept string | number at the boundary.
export const registrationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  personId: z.string().nullable(),
  status: z.string(),
  totalAmount: z.union([z.string(), z.number()]),
  paidAmount: z.union([z.string(), z.number()]),
  // json payload — the full normalised answer set; passthrough at the boundary.
  formAnswers: z.any().nullable(),
  checkedInAt: z.string().nullable(),
})
export type Registration = z.infer<typeof registrationSchema>

export const registrationListSchema = z.array(registrationSchema)

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
  sortOrder: z.number().int(),
})
export type EventCategory = z.infer<typeof eventCategorySchema>
export const eventCategoryListSchema = z.array(eventCategorySchema)
export const eventCategoryCreateSchema = eventCategorySchema.omit({ id: true }).partial({
  parentId: true, color: true, icon: true, defaultTc: true, defaultFormId: true,
  defaultXeroCodes: true, sortOrder: true,
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
export const registrationCreateSchema = registrationSchema.omit({ id: true }).partial({
  personId: true, status: true, totalAmount: true, paidAmount: true,
  formAnswers: true, checkedInAt: true,
})
export type RegistrationCreate = z.infer<typeof registrationCreateSchema>
export const registrationPatchSchema = registrationCreateSchema.partial()
export type RegistrationPatch = z.infer<typeof registrationPatchSchema>

// ── Connection groups (saved invitee sets) + their event links ──
export const connectionGroupSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
})
export type ConnectionGroup = z.infer<typeof connectionGroupSchema>
export const connectionGroupListSchema = z.array(connectionGroupSchema)
