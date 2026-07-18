// The CONTRACT for the finances domain: Zod schemas + the domain types inferred
// from them, shared by the client (typed composable) and the server (Nitro route
// output validation). DB-neutral by design — the json columns (conditions,
// eligibility, feeAccounts) are `json` in MySQL today, were jsonb before, and the
// UI only ever sees plain JS values; only the repository mapper knows the storage.
//
// Money note: decimal columns (modifierValue) come back from mysql2 as a *string*,
// so the boundary accepts string|number (and null for safety) rather than forcing a
// lossy Number() at the seam.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// A string|number|null money value — a mysql2 decimal is a string, but a computed
// value may arrive as a number; either is accepted unchanged.
const money = z.union([z.string(), z.number()]).nullable()

// An EVENT discount (table `discounts`) — a price modifier on one event's
// registration. The table has no org_id of its own (it's event-scoped), so `orgId`
// is resolved from the linked event by the repository. `conditions`/`eligibility`
// are free json payloads the discount engine reads; passthrough at the boundary.
export const discountSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  eventId: z.string().nullable(),
  type: z.string(),
  name: z.string(),
  code: z.string().nullable(),
  formText: z.string().nullable(),
  modifierType: z.string(),
  modifierValue: money,
  applyTo: z.string(),
  conditions: z.any().nullable(),
  eligibility: z.any().nullable(),
  usageCap: z.number().int().nullable(),
  perUserCap: z.number().int().nullable(),
  minSessions: z.number().int().nullable(),
  linkedEventId: z.string().nullable(),
  validFrom: z.string().nullable(),
  expiresAt: z.string().nullable(),
  isActive: z.boolean(),
})
export type Discount = z.infer<typeof discountSchema>

export const discountListSchema = z.array(discountSchema)

// WRITE contracts. Create omits the server-owned id AND orgId (the table has no
// org_id — it's resolved from the linked event by the repo). name is required; the
// notNull columns (type / modifierType / modifierValue / applyTo / conditions /
// isActive) default in the repo, everything else is optional. Patch is a partial.
export const discountCreateSchema = discountSchema
  .omit({ id: true, orgId: true })
  .partial({
    eventId: true,
    type: true,
    code: true,
    formText: true,
    modifierType: true,
    modifierValue: true,
    applyTo: true,
    conditions: true,
    eligibility: true,
    usageCap: true,
    perUserCap: true,
    minSessions: true,
    linkedEventId: true,
    validFrom: true,
    expiresAt: true,
    isActive: true,
  })
  .extend({ name: z.string().min(1) })
export type DiscountCreate = z.infer<typeof discountCreateSchema>

export const discountPatchSchema = discountCreateSchema.partial()
export type DiscountPatch = z.infer<typeof discountPatchSchema>

// A BOOKING discount (table `booking_discounts`) — the resource-booking twin of an
// event discount, scoped directly to an org with its own use caps + validity window.
export const bookingDiscountSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  formText: z.string().nullable(),
  modifierType: z.string(),
  modifierValue: money,
  applyTo: z.string(),
  conditions: z.any().nullable(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  maxUses: z.number().int().nullable(),
  usesCount: z.number().int(),
  isActive: z.boolean(),
})
export type BookingDiscount = z.infer<typeof bookingDiscountSchema>

export const bookingDiscountListSchema = z.array(bookingDiscountSchema)

// An org's Xero connection (table `xero_connections`) — the mapping defaults the
// sync layer uses. SECRETS ARE DELIBERATELY OMITTED: refresh_token / access_token
// never leave the server, so they are not part of the boundary contract.
// `feeAccounts` is the club's named "accounts you use" shortlist (free json).
export const xeroConnectionSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  tenantId: z.string(),
  tenantName: z.string().nullable(),
  salesAccountCode: z.string().nullable(),
  bankAccountCode: z.string().nullable(),
  bankAccountName: z.string().nullable(),
  taxType: z.string().nullable(),
  feeAccounts: z.any().nullable(),
  status: z.string(),
  connectedAt: z.string().nullable(),
})
export type XeroConnection = z.infer<typeof xeroConnectionSchema>

// The connection is a per-org singleton — null when the org hasn't connected Xero.
export const xeroConnectionOrNullSchema = xeroConnectionSchema.nullable()

// ── Fee components (read-only on the finances screen) ────────────────────────
// A fee line on an event (table `fee_components`). It has no org_id of its own —
// scoped via its event by the repo — and the joined event {id,title} feeds the
// finances table's Event column. `amount`/`depositPercent` are decimals (string
// from mysql2), so they take the money union.
export const feeComponentSchema = z.object({
  id: z.string(),
  eventId: z.string().nullable(),
  name: z.string().nullable(),
  amount: money,
  xeroCode: z.string().nullable(),
  isLocked: z.boolean(),
  depositPercent: money,
  sortOrder: z.number().int().nullable(),
  event: z.object({ id: z.string(), title: z.string().nullable() }).nullable(),
})
export type FeeComponent = z.infer<typeof feeComponentSchema>
export const feeComponentListSchema = z.array(feeComponentSchema)

// ── Add-ons (event extras: table `addons`) ───────────────────────────────────
// Same event-scoping as fee components (no org_id — via the linked event). The
// finances screen lists + creates + deletes them.
export const addonSchema = z.object({
  id: z.string(),
  eventId: z.string().nullable(),
  type: z.string().nullable(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  price: money,
  stockLimit: z.number().int().nullable(),
  sortOrder: z.number().int().nullable(),
  event: z.object({ id: z.string(), title: z.string().nullable() }).nullable(),
})
export type Addon = z.infer<typeof addonSchema>
export const addonListSchema = z.array(addonSchema)

// Create omits the server-owned id + join. eventId + name required; the rest default.
export const addonCreateSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().optional(),
  price: money.optional(),
  stockLimit: z.number().int().nullable().optional(),
  description: z.string().nullable().optional(),
})
export type AddonCreate = z.infer<typeof addonCreateSchema>

// ── Org currency (the one org setting the finances/reporting screens format with) ─
// Deliberately a tiny standalone read: currency lives on `organisations` (the admin
// domain), but formatting money is a finances concern, so a minimal read is owned
// here rather than widening the org/orgSettings contract. See cross-domain note.
export const orgCurrencySchema = z.object({ currency: z.string() })
export type OrgCurrency = z.infer<typeof orgCurrencySchema>

// ── Reporting rollup (the /reporting dashboard) ──────────────────────────────
// A read-only aggregate over events (+ their category) and invitees. The page does
// its own client-side status/category grouping, so the boundary just hands back the
// event rows (with category name/color) and the raw invitee {eventId,status} list.
export const reportingEventSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  style: z.string().nullable(),
  status: z.string().nullable(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  isAllDay: z.boolean(),
  category: z.object({ name: z.string().nullable(), color: z.string().nullable() }).nullable(),
})
export type ReportingEvent = z.infer<typeof reportingEventSchema>
export const reportingInviteeSchema = z.object({ eventId: z.string().nullable(), status: z.string() })
export const reportingBundleSchema = z.object({
  events: z.array(reportingEventSchema),
  invitees: z.array(reportingInviteeSchema),
})
export type ReportingBundle = z.infer<typeof reportingBundleSchema>

// ── Attendance sessions (the /attendance landing) ────────────────────────────
// Every group-linked training event occurrence in a date window — the page keeps
// its own date/label formatting, so the boundary returns the raw fields it needs
// (event time + resolved group + resolved bookable name).
export const attendanceSessionSchema = z.object({
  eventId: z.string(),
  startAt: z.string().nullable(),
  endAt: z.string().nullable(),
  locationType: z.string().nullable(),
  bookableName: z.string().nullable(),
  address: z.string().nullable(),
  meetingLink: z.string().nullable(),
  groupName: z.string().nullable(),
  groupColor: z.string().nullable(),
  locationId: z.string().nullable(),
})
export type AttendanceSession = z.infer<typeof attendanceSessionSchema>
export const attendanceSessionListSchema = z.array(attendanceSessionSchema)

// ── Custom reports (table `custom_reports`) ──────────────────────────────────
// A club-built people report — filters + columns saved as a json `config`. The
// config shape (match/filters/columns) is the client's ReportConfig; the boundary
// passes it through as free json.
export const customReportSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.any()),
  sortOrder: z.number().int(),
})
export type CustomReport = z.infer<typeof customReportSchema>
export const customReportListSchema = z.array(customReportSchema)
export const customReportOrNullSchema = customReportSchema.nullable()

export const customReportCreateSchema = z.object({
  name: z.string().min(1),
  config: z.record(z.string(), z.any()),
})
export type CustomReportCreate = z.infer<typeof customReportCreateSchema>
export const customReportPatchSchema = z.object({
  name: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
})
export type CustomReportPatch = z.infer<typeof customReportPatchSchema>

// ── Report run-data (the people a custom report filters over) ────────────────
// SNAKE_CASE ON PURPOSE: these keys are the FIELD VOCABULARY saved inside report
// configs (first_name, dob, person_types, cf:<id>…) and applied by the pure filter
// engine in useCustomReports — they are user-facing field identifiers, not internal
// column names, so camelCasing them here would break every saved report. `__positions`
// is the per-person union of member-group positions (from member_group_memberships).
export const reportPersonSchema = z.object({
  id: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  dob: z.string().nullable(),
  gender: z.string().nullable(),
  membership_type: z.string().nullable(),
  person_type: z.string().nullable(),
  person_types: z.array(z.string()),
  custom_fields: z.record(z.string(), z.any()),
  photo_url: z.string().nullable(),
  __positions: z.array(z.string()),
})
export type ReportPerson = z.infer<typeof reportPersonSchema>
export const reportPersonListSchema = z.array(reportPersonSchema)
export const reportPositionsSchema = z.array(z.string())
