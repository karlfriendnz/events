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
  ageMin: z.number().int().nullable(),
  ageMax: z.number().int().nullable(),
  recurrenceRule: z.string().nullable(),
  recurrenceParentId: z.string().nullable(),
  createdVia: z.string().nullable(),
  // json array of YYYY-MM-DD skip-dates. Empty when none.
  exdates: z.array(z.string()),
})
export type FMEvent = z.infer<typeof fmEventSchema>

export const fmEventListSchema = z.array(fmEventSchema)

// One occurrence of an event. NB: the `sessions` table has no `status` column
// (session lifecycle is carried elsewhere) — status is exposed as nullable for
// contract stability and mapped to null. start/end are nullable in the schema.
export const sessionSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  status: z.string().nullable(),
  capacityMax: z.number().int().nullable(),
  locationType: z.string(),
  address: z.string().nullable(),
  meetingLink: z.string().nullable(),
  isMaster: z.boolean(),
  masterId: z.string().nullable(),
  // json array of add-on definitions.
  addons: z.array(z.any()),
})
export type Session = z.infer<typeof sessionSchema>

export const sessionListSchema = z.array(sessionSchema)

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
