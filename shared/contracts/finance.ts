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
