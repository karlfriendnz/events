// The CONTRACT for the bookings domain: Zod schemas + the domain types inferred
// from them, shared by the client (typed composable) and the server (Nitro route
// output validation). DB-neutral by design — the array columns (sections, features,
// categories, sports) and the jsonb payloads (a mode's pricing/addons) are `json`
// in MySQL today, were Postgres arrays/jsonb before, and could be anything behind a
// future API; the UI only ever sees `string[]` / plain objects, and only the
// repository mapper knows the storage. Timestamps cross the wire as ISO 8601.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// MySQL decimals come back as strings; accept either so a numeric payload also passes.
const money = z.union([z.string(), z.number()]).nullable()

// A bookable resource — a venue, court, item, or staff/person. `type` and `status`
// are open strings (validated as sets by the boundary, not a DB CHECK). The four
// json arrays default to [] when unset.
export const bookableSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  type: z.string(),
  parentId: z.string().nullable(),
  masterId: z.string().nullable(),
  maxConcurrent: z.number().int(),
  status: z.string(),
  isPublic: z.boolean(),
  sections: z.array(z.string()),
  features: z.array(z.string()),
  categories: z.array(z.string()),
  sports: z.array(z.string()),
})
export type Bookable = z.infer<typeof bookableSchema>

export const bookableListSchema = z.array(bookableSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it) and
// makes everything but orgId + name optional — the repo/DB supply the rest. The
// four json arrays default to [] in the repo. Update is a partial.
export const bookableCreateSchema = bookableSchema
  .omit({ id: true })
  .partial({
    type: true, parentId: true, masterId: true, maxConcurrent: true, status: true,
    isPublic: true, sections: true, features: true, categories: true, sports: true,
  })
  .extend({ name: z.string().min(1) })
export type BookableCreate = z.infer<typeof bookableCreateSchema>

export const bookablePatchSchema = bookableCreateSchema.partial()
export type BookablePatch = z.infer<typeof bookablePatchSchema>

// An activity — the bookable "thing to do" (a court hire, a coaching service, an
// item rental). `bookingFlow` (wizard|scheduler|item) and `assignmentMode` are open
// strings. `staffBookableId` non-null = owned by one staff/PERSON bookable.
export const activitySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string(),
  imageUrl: z.string().nullable(),
  status: z.string(),
  staffBookableId: z.string().nullable(),
  bookingFlow: z.string(),
  assignmentMode: z.string(),
  bookingsEnabled: z.boolean(),
})
export type Activity = z.infer<typeof activitySchema>

export const activityListSchema = z.array(activitySchema)

// WRITE contracts. Create omits the server-owned id and requires only orgId +
// name; the repo/DB supply the rest (activities has no json columns). Update is a
// partial.
export const activityCreateSchema = activitySchema
  .omit({ id: true })
  .partial({
    description: true, color: true, icon: true, imageUrl: true, status: true,
    staffBookableId: true, bookingFlow: true, assignmentMode: true, bookingsEnabled: true,
  })
  .extend({ name: z.string().min(1) })
export type ActivityCreate = z.infer<typeof activityCreateSchema>

export const activityPatchSchema = activityCreateSchema.partial()
export type ActivityPatch = z.infer<typeof activityPatchSchema>

// A mode of an activity (e.g. "Singles", "Doubles", a rate card). `pricing` is a
// free jsonb object, `addons` a jsonb array — passthrough at the boundary. Item
// modes carry period_* + term_type + period_price (decimal → string|number|null).
export const activityModeSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  pricing: z.record(z.string(), z.any()).nullable(),
  addons: z.array(z.any()).nullable(),
  configurationKey: z.string().nullable(),
  formId: z.string().nullable(),
  sortOrder: z.number().int(),
  periodUnit: z.string().nullable(),
  periodCount: z.number().int(),
  termType: z.string(),
  periodPrice: money,
})
export type ActivityMode = z.infer<typeof activityModeSchema>

export const activityModeListSchema = z.array(activityModeSchema)

// A booking of a bookable. NB there is no org_id column on bookings — the repository
// derives orgId by joining the bookable, so the domain object stays org-scoped like
// everything else. Timestamps (startAt/endAt) cross the wire as ISO 8601.
export const bookingSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  bookableId: z.string(),
  activityId: z.string().nullable(),
  activityModeId: z.string().nullable(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.string(),
  parentBookingId: z.string().nullable(),
  isRecurring: z.boolean(),
  subjectPersonId: z.string().nullable(),
  accessCode: z.string().nullable(),
})
export type Booking = z.infer<typeof bookingSchema>

export const bookingListSchema = z.array(bookingSchema)
