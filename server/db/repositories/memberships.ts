// The repository: the ONLY code that knows how memberships & terms are stored. It
// turns DB rows into domain objects (the contract shape) and back. Nitro routes call
// these functions; they never touch Drizzle or the DB directly. When the backend
// team's MySQL API replaces this, only this file changes — routes, composables and
// UI are untouched.
//
// json/date/decimal handling: start/end/signup dates are MySQL `date` columns —
// mysql2 hands them back as a Date (or a string depending on config), so `toDateStr`
// normalises either into a yyyy-mm-dd ISO string using LOCAL components (a date has
// no timezone; toISOString could shift the day). DECIMAL columns (price, fee,
// benefit_value) come back as strings — the contract accepts string|number, so they
// pass through untouched. A null `sort_order` coalesces to 0 so the contract parses.
import { asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  MembershipEntitlement,
  MembershipPlanOption,
  MembershipPlanWithOptions,
  OrgTerm,
  TermSet,
} from '../../../shared/contracts/membership'

// Coerce a MySQL `date` value into a yyyy-mm-dd string (or null). A Date is formatted
// from its LOCAL components (no tz on a bare date); a string is truncated to 10 chars.
function toDateStr(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) {
    const y = v.getFullYear()
    const m = String(v.getMonth() + 1).padStart(2, '0')
    const d = String(v.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(v).slice(0, 10)
}

// A DECIMAL column: mysql2 returns a string, a repo may hand back a number — either
// is contract-valid. Undefined → null.
function asDecimal(v: unknown): string | number | null {
  if (v == null) return null
  return v as string | number
}

function toEntitlement(r: typeof schema.membershipEntitlements.$inferSelect): MembershipEntitlement {
  return {
    id: r.id,
    orgId: r.orgId,
    membershipGroupId: r.membershipGroupId,
    targetType: r.targetType,
    targetId: r.targetId,
    benefitType: r.benefitType,
    benefitValue: asDecimal(r.benefitValue),
  }
}

function toPlanOption(r: typeof schema.membershipPlanOptions.$inferSelect): MembershipPlanOption {
  return {
    id: r.id,
    planId: r.planId,
    name: r.name ?? null,
    periodUnit: r.periodUnit,
    periodCount: r.periodCount,
    price: asDecimal(r.price),
    autoRenew: r.autoRenew,
    sortOrder: r.sortOrder ?? 0,
  }
}

function toTerm(r: typeof schema.orgTerms.$inferSelect): OrgTerm {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    startDate: toDateStr(r.startDate),
    endDate: toDateStr(r.endDate),
    signupOpen: toDateStr(r.signupOpen),
    signupClose: toDateStr(r.signupClose),
    status: r.status,
    sortOrder: r.sortOrder ?? 0,
    setId: r.setId ?? null,
  }
}

function toTermSet(r: typeof schema.termSets.$inferSelect): TermSet {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    sortOrder: r.sortOrder ?? 0,
    sportId: r.sportId ?? null,
  }
}

/** What one membership group includes — its entitlement rows, in author order. */
export async function listEntitlements(membershipGroupId: string): Promise<MembershipEntitlement[]> {
  const rows = await db
    .select()
    .from(schema.membershipEntitlements)
    .where(eq(schema.membershipEntitlements.membershipGroupId, membershipGroupId))
    .orderBy(asc(schema.membershipEntitlements.sortOrder))
  return rows.map(toEntitlement)
}

/** Every membership plan an org has, each hydrated with its duration options. */
export async function listPlans(orgId: string): Promise<MembershipPlanWithOptions[]> {
  const plans = await db
    .select()
    .from(schema.membershipPlans)
    .where(eq(schema.membershipPlans.orgId, orgId))
    .orderBy(asc(schema.membershipPlans.sortOrder))
  if (plans.length === 0) return []

  const planIds = plans.map((p) => p.id)
  const options = await db
    .select()
    .from(schema.membershipPlanOptions)
    .where(inArray(schema.membershipPlanOptions.planId, planIds))
    .orderBy(asc(schema.membershipPlanOptions.sortOrder))

  const optionsByPlan = new Map<string, MembershipPlanOption[]>()
  for (const o of options) {
    const opt = toPlanOption(o)
    const list = optionsByPlan.get(opt.planId) ?? []
    list.push(opt)
    optionsByPlan.set(opt.planId, list)
  }

  return plans.map((p) => ({
    id: p.id,
    orgId: p.orgId,
    name: p.name,
    description: p.description ?? null,
    color: p.color ?? null,
    status: p.status,
    sortOrder: p.sortOrder ?? 0,
    options: optionsByPlan.get(p.id) ?? [],
  }))
}

/** Every term/season an org has defined, in author order. */
export async function listTerms(orgId: string): Promise<OrgTerm[]> {
  const rows = await db
    .select()
    .from(schema.orgTerms)
    .where(eq(schema.orgTerms.orgId, orgId))
    .orderBy(asc(schema.orgTerms.sortOrder))
  return rows.map(toTerm)
}

/** Every term set (sequence) an org has, in author order. */
export async function listTermSets(orgId: string): Promise<TermSet[]> {
  const rows = await db
    .select()
    .from(schema.termSets)
    .where(eq(schema.termSets.orgId, orgId))
    .orderBy(asc(schema.termSets.sortOrder))
  return rows.map(toTermSet)
}
