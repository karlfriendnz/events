// The CONTRACT for the waitlists & communications domain: Zod schemas + the domain
// types inferred from them, shared by the client (typed composable) and the server
// (Nitro route output validation). DB-neutral by design — json columns (a topic's
// channels, a calendar's settings) surface as plain string[] / any at the boundary,
// timestamps as ISO strings; only the repository mapper knows the storage.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A shared queue for equivalent groups (same class, different days). Tied to a term
// and carried across term rollover under a stable lineage.
export const waitlistSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  // Nullable — a legacy/evergreen waitlist may sit outside any term or lineage.
  termId: z.string().nullable(),
  orderMode: z.string(),
  lineageId: z.string().nullable(),
})
export type Waitlist = z.infer<typeof waitlistSchema>

export const waitlistListSchema = z.array(waitlistSchema)

// WRITE contracts. Create omits the server-owned id; name + orgId are required,
// orderMode + the term/lineage links default in the repo. Patch is a partial.
export const waitlistCreateSchema = waitlistSchema
  .omit({ id: true })
  .partial({ termId: true, orderMode: true, lineageId: true })
  .extend({ name: z.string().min(1) })
export type WaitlistCreate = z.infer<typeof waitlistCreateSchema>

export const waitlistPatchSchema = waitlistCreateSchema.partial()
export type WaitlistPatch = z.infer<typeof waitlistPatchSchema>

// One person waiting in a queue, with their position + priority.
export const waitlistEntrySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  waitlistId: z.string(),
  personId: z.string(),
  status: z.string(),
  priority: z.number().int(),
  sortOrder: z.number().int(),
  // ISO 8601; nullable defaultNow row may realistically never be null, but honest.
  createdAt: z.string().nullable(),
})
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>

export const waitlistEntryListSchema = z.array(waitlistEntrySchema)

// A message sent to an event's audience. Stored keyed to an event with no status
// column, so `orgId` is resolved via the event and `status` is derived at the seam.
export const communicationSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  subject: z.string(),
  body: z.string(),
  status: z.string(),
  recipientCount: z.number().int(),
  createdAt: z.string().nullable(),
})
export type Communication = z.infer<typeof communicationSchema>

export const communicationListSchema = z.array(communicationSchema)

// A comms category a person can subscribe to. Core topics are platform-wide, so
// `orgId` is nullable.
export const communicationTopicSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  name: z.string(),
  // json array → plain string[] at the boundary.
  channels: z.array(z.string()),
})
export type CommunicationTopic = z.infer<typeof communicationTopicSchema>

export const communicationTopicListSchema = z.array(communicationTopicSchema)

// The club's default wording for a kind of email (invitation, reminder, …).
export const emailTemplateSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  key: z.string(),
  subject: z.string(),
  body: z.string(),
})
export type EmailTemplate = z.infer<typeof emailTemplateSchema>

export const emailTemplateListSchema = z.array(emailTemplateSchema)

// A named calendar a club can pin to its nav and theme.
export const calendarSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  pinToNav: z.boolean(),
  // json blob of per-calendar prefs — passthrough at the boundary.
  settings: z.any().nullable(),
})
export type Calendar = z.infer<typeof calendarSchema>

export const calendarListSchema = z.array(calendarSchema)

// A category shown on a calendar. Contract shape only (no list route yet) — the
// name/colour live on `categories`, linked through the `calendar_categories` join.
export const calendarCategorySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  calendarId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
})
export type CalendarCategory = z.infer<typeof calendarCategorySchema>

export const calendarCategoryListSchema = z.array(calendarCategorySchema)
