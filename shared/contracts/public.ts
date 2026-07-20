// The CONTRACTS for the PUBLIC (anonymous, read-only) surface — the ONLY data an
// unauthenticated visitor can ever see. Every field here is deliberately public-safe:
// club presentation, published events, live class registration info, the booker menu.
//
// What is NOT here is the point of the file: no invitees, no persons, no contact
// details, no internal notes, no admin/created_by fields, no financial internals, no
// draft/unpublished content. The repository (server/db/repositories/public.ts) maps
// raw rows down to exactly these shapes, and every public route parses-on-output
// against them — so the anonymous exposure surface is this file, auditable in one place.
//
// Shared/ so both the Vue app (usePublicApi) and the Nitro routes import one definition.
import { z } from 'zod'

// ── Org (public presentation only) ──────────────────────────────────────────
// The club's public face: name + branding + booker theme. Never its contact
// details, parent, modules, or any internal settings.
export const publicOrgSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Brand colours (migration 179) drive the embed calendar accent + branded surfaces.
  brandColor: z.string().nullable(),
  brandTextColor: z.string().nullable(),
  logoUrl: z.string().nullable(),
  currency: z.string(),
  // The public booker's themeable canvas/primary/on_primary (jsonb, open shape).
  bookerTheme: z.record(z.string(), z.any()),
})
export type PublicOrg = z.infer<typeof publicOrgSchema>

// ── Events (published, dated, public) ───────────────────────────────────────
// One row for the embed calendar. categoryColor tints the bar; formId decides
// whether a click can go anywhere (a public registration page exists only with one).
export const publicEventSchema = z.object({
  id: z.string(),
  title: z.string(),
  // ISO timestamps. A PUBLIC event is dated by construction (the repo excludes
  // start_at IS NULL — the staff calendar parks undated events on today, a public
  // surface must not invent a date), so startAt is never null here.
  startAt: z.string(),
  endAt: z.string().nullable(),
  isAllDay: z.boolean(),
  locationType: z.string(),
  address: z.string().nullable(),
  description: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  // Non-null only when a registration form is linked — the calendar uses this to
  // decide whether an event click opens /r/event/:id or is a no-op.
  formId: z.string().nullable(),
  // The calendar (category) this event sits on + its colour, for the calendar bar.
  categoryId: z.string().nullable(),
  categoryColor: z.string().nullable(),
})
export type PublicEvent = z.infer<typeof publicEventSchema>
export const publicEventListSchema = z.array(publicEventSchema)

// A public session row (the subset a registrant needs to pick sessions + see fees).
// No capacity internals, no bookable_id, no admin fields.
export const publicSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  startAt: z.string().nullable(),
  required: z.boolean(),
  display: z.boolean(),
  // Sum of this session's fee components — what the registrant pays for it.
  fee: z.number(),
})
export type PublicSession = z.infer<typeof publicSessionSchema>

// An event-level fee line item (name + amount only).
export const publicFeeLineSchema = z.object({
  name: z.string(),
  amount: z.number(),
})
export type PublicFeeLine = z.infer<typeof publicFeeLineSchema>

// An active discount surfaced on the registration landing to encourage sign-up.
// Carries the eligibility fields too, so the CLIENT can evaluate which discounts a
// given registrant actually qualifies for (an accurate "save $X" preview) rather
// than showing every discount unconditionally. Money stays authoritative SERVER-side
// (public-form-submit recomputes total + discount), so these are display-only.
export const publicDiscountSchema = z.object({
  name: z.string(),
  formText: z.string().nullable(),
  modifierType: z.string(),
  modifierValue: z.number(),
  conditions: z.any().nullable().optional(),
  applyTo: z.string().nullable().optional(),
  validFrom: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})
export type PublicDiscount = z.infer<typeof publicDiscountSchema>

// One public event PLUS everything the registration page needs to render its form:
// the resolved form config, sessions, event-level fee lines, active discounts.
export const publicEventDetailSchema = publicEventSchema.extend({
  orgId: z.string(),
  // The linked registration_forms.config (open jsonb) — null when no form is set.
  formConfig: z.record(z.string(), z.any()).nullable(),
  formName: z.string().nullable(),
  sessions: z.array(publicSessionSchema),
  feeLineItems: z.array(publicFeeLineSchema),
  discounts: z.array(publicDiscountSchema),
  // Age gate (migration 264) — the renderer enforces it at submit.
  ageMin: z.number().nullable(),
  ageMax: z.number().nullable(),
})
export type PublicEventDetail = z.infer<typeof publicEventDetailSchema>

// A group's fee OPTION — the registrant picks one ("how would you like to pay?").
// label + total are computed server-side so the client renders without any pricing
// logic (or knowledge of the fee model internals).
export const publicFeeOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  total: z.number(),
  description: z.string().nullable(),
})
export type PublicFeeOption = z.infer<typeof publicFeeOptionSchema>

// ── Group (public class registration) ───────────────────────────────────────
// A class the public can register into: name, banner, its form, its fee options,
// plus a full/waitlist status + the equivalent classes with space (siblings on the
// same waitlist) so a full Thursday can offer Friday.
export const publicGroupSiblingSchema = z.object({
  id: z.string(),
  name: z.string(),
  spaces: z.number().nullable(),
  // The sibling's own linked form (nullable). The page uses it to decide whether the
  // sibling link should carry the current form_id (only when the sibling has none).
  formId: z.string().nullable(),
})
export const publicGroupSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  imageUrl: z.string().nullable(),
  formId: z.string().nullable(),
  feeOptions: z.array(publicFeeOptionSchema),
  // Capacity status (never the roster). full = at/over capacity for members.
  full: z.boolean(),
  waitlistName: z.string().nullable(),
  siblingsWithSpace: z.array(publicGroupSiblingSchema),
})
export type PublicGroup = z.infer<typeof publicGroupSchema>

// ── Form (a form connected to classes) ──────────────────────────────────────
// A registration form + the classes it's connected to (targets → member_groups,
// expanding code/programme targets), each with live spaces + its fee options, so
// the in-form "choose your class" block can render. Section = the code label.
export const publicFormTargetSchema = z.object({
  id: z.string(),
  name: z.string(),
  section: z.string().nullable(),
  spaces: z.number().nullable(),
  full: z.boolean(),
  waitlistable: z.boolean(),
  feeOptions: z.array(publicFeeOptionSchema),
})
export type PublicFormTarget = z.infer<typeof publicFormTargetSchema>

export const publicFormSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.any()),
  targets: z.array(publicFormTargetSchema),
})
export type PublicForm = z.infer<typeof publicFormSchema>

// ── Booker (the public /book menu) ──────────────────────────────────────────
// A bookings-enabled public activity + its modes. Only the presentation + booking
// shape — never pricing internals beyond the display period price the menu shows.
export const publicBookerModeSchema = z.object({
  id: z.string(),
  name: z.string(),
  activityId: z.string(),
  category: z.string().nullable(),
  periodPrice: z.number().nullable(),
  periodUnit: z.string().nullable(),
})
export type PublicBookerMode = z.infer<typeof publicBookerModeSchema>

export const publicBookerActivitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  imageUrl: z.string().nullable(),
  bookingFlow: z.string(),
  status: z.string(),
  bookingsEnabled: z.boolean(),
  staffBookableId: z.string().nullable(),
  modes: z.array(publicBookerModeSchema),
})
export type PublicBookerActivity = z.infer<typeof publicBookerActivitySchema>

// A public bookable (venue/court/item) — only the public-safe presentation + tree
// fields the booking flow needs. Never internal names, access hardware, or rules.
export const publicBookableSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  parentId: z.string().nullable(),
  masterId: z.string().nullable(),
  maxConcurrent: z.number(),
  mainImage: z.string().nullable(),
})
export type PublicBookable = z.infer<typeof publicBookableSchema>

// A public availability rule (open hours) — public by nature. Kept as an open shape
// because the calendar reads many optional fields (time_slots, rrule, valid_from…).
export const publicAvailabilityRuleSchema = z.record(z.string(), z.any())
export type PublicAvailabilityRule = z.infer<typeof publicAvailabilityRuleSchema>

export const publicBookerSchema = z.object({
  org: publicOrgSchema,
  activities: z.array(publicBookerActivitySchema),
  bookables: z.array(publicBookableSchema),
  availability: z.array(publicAvailabilityRuleSchema),
})
export type PublicBooker = z.infer<typeof publicBookerSchema>
