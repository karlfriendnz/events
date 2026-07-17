// The CONTRACT for the memberships & terms domain: Zod schemas + the domain types
// inferred from them, shared by the client (typed composable) and the server (Nitro
// route output validation). DB-neutral by design — dates arrive as ISO strings
// (yyyy-mm-dd for date-only columns), decimals as strings-or-numbers (mysql2 hands
// DECIMAL back as a string), and open string sets (targetType, benefitType,
// periodUnit, status) are plain strings validated at the boundary, never a DB CHECK.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
import { z } from 'zod'

// mysql2 returns DECIMAL as a string; a repo may hand back a number. Accept either.
const decimalSchema = z.union([z.string(), z.number()]).nullable()

// One entitlement a membership grants — what buying this membership includes, and at
// what benefit level (a whole group/code/event; benefitType = included | discount…).
export const membershipEntitlementSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  membershipGroupId: z.string(),
  targetType: z.string(),
  targetId: z.string(),
  benefitType: z.string(),
  benefitValue: decimalSchema,
})
export type MembershipEntitlement = z.infer<typeof membershipEntitlementSchema>
export const membershipEntitlementListSchema = z.array(membershipEntitlementSchema)

// A named membership plan (legacy model — Senior/Junior) grouping its duration options.
export const membershipPlanSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  status: z.string(),
  sortOrder: z.number().int(),
})
export type MembershipPlan = z.infer<typeof membershipPlanSchema>
export const membershipPlanListSchema = z.array(membershipPlanSchema)

// A duration option under a plan (1/3/6 month, still the same plan).
export const membershipPlanOptionSchema = z.object({
  id: z.string(),
  planId: z.string(),
  name: z.string().nullable(),
  periodUnit: z.string(),
  periodCount: z.number().int(),
  price: decimalSchema,
  autoRenew: z.boolean(),
  sortOrder: z.number().int(),
})
export type MembershipPlanOption = z.infer<typeof membershipPlanOptionSchema>
export const membershipPlanOptionListSchema = z.array(membershipPlanOptionSchema)

// A plan hydrated with its options — the shape listPlans returns.
export const membershipPlanWithOptionsSchema = membershipPlanSchema.extend({
  options: membershipPlanOptionListSchema,
})
export type MembershipPlanWithOptions = z.infer<typeof membershipPlanWithOptionsSchema>
export const membershipPlanWithOptionsListSchema = z.array(membershipPlanWithOptionsSchema)

// An org-wide term/season — a date range the club runs classes in, with its own
// sign-up window (dates as yyyy-mm-dd ISO strings). setId groups it into a sequence.
export const orgTermSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  signupOpen: z.string().nullable(),
  signupClose: z.string().nullable(),
  status: z.string(),
  sortOrder: z.number().int(),
  setId: z.string().nullable(),
})
export type OrgTerm = z.infer<typeof orgTermSchema>
export const orgTermListSchema = z.array(orgTermSchema)

// An independent sequence of terms (the legacy "term set" concept); may belong to a sport.
export const termSetSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  sportId: z.string().nullable(),
})
export type TermSet = z.infer<typeof termSetSchema>
export const termSetListSchema = z.array(termSetSchema)
