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
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  MembershipEntitlement,
  MembershipEntitlementInput,
  MembershipPlan,
  MembershipPlanOption,
  MembershipPlanOptionCreate,
  MembershipPlanOptionPatch,
  MembershipPlanWithOptions,
  MembershipPlanCreate,
  MembershipPlanPatch,
  OrgTerm,
  OrgTermCreate,
  OrgTermPatch,
  TermSet,
  TermSetCreate,
  TermSetPatch,
  GroupBilling,
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

// The base plan row (without its options) — used to re-read a plan after a write.
// listPlans inlines the same mapping while hydrating options.
function toPlan(r: typeof schema.membershipPlans.$inferSelect): MembershipPlan {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    description: r.description ?? null,
    color: r.color ?? null,
    status: r.status,
    sortOrder: r.sortOrder ?? 0,
  }
}

// A term set's location_ids is a json array (or null = whole club). mysql2 usually
// hands json back parsed, but a driver can return the raw string — normalise either.
function asArrayOrNull(v: unknown): string[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? (parsed as string[]) : null
    } catch {
      return null
    }
  }
  return null
}

function toTermSet(r: typeof schema.termSets.$inferSelect): TermSet {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    sortOrder: r.sortOrder ?? 0,
    sportId: r.sportId ?? null,
    locationIds: asArrayOrNull(r.locationIds),
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

// One term / one plan by id, or null — used to re-read a row after a write and map it
// through the same mappers as the list reads (there's no public single-row getter).
async function loadTerm(id: string): Promise<OrgTerm | null> {
  const [r] = await db.select().from(schema.orgTerms).where(eq(schema.orgTerms.id, id)).limit(1)
  return r ? toTerm(r) : null
}

async function loadPlan(id: string): Promise<MembershipPlan | null> {
  const [r] = await db.select().from(schema.membershipPlans).where(eq(schema.membershipPlans.id, id)).limit(1)
  return r ? toPlan(r) : null
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). `as any` on the insert values:
// the first-pass schema marks columns .notNull() without their DB defaults, so
// Drizzle's insert type over-requires them; consistent with the app's (db.from as any)
// idiom. org_terms has no json columns; start/end are notNull `date` columns with no
// DB default, so a caller who omits them gets today (a date string passes straight to
// Drizzle's date mode).
export async function createTerm(input: OrgTermCreate): Promise<OrgTerm> {
  const id = randomUUID()
  const today = new Date().toISOString().slice(0, 10)
  await db.insert(schema.orgTerms).values({
    id,
    orgId: input.orgId,
    name: input.name,
    startDate: input.startDate ?? today,
    endDate: input.endDate ?? today,
    signupOpen: input.signupOpen ?? null,
    signupClose: input.signupClose ?? null,
    status: input.status ?? 'active',
    sortOrder: input.sortOrder ?? 0,
    setId: input.setId ?? null,
  } as any)
  return (await loadTerm(id))!
}

export async function updateTerm(id: string, patch: OrgTermPatch): Promise<OrgTerm | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.startDate !== undefined) set.startDate = patch.startDate
  if (patch.endDate !== undefined) set.endDate = patch.endDate
  if (patch.signupOpen !== undefined) set.signupOpen = patch.signupOpen
  if (patch.signupClose !== undefined) set.signupClose = patch.signupClose
  if (patch.status !== undefined) set.status = patch.status
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.setId !== undefined) set.setId = patch.setId
  if (Object.keys(set).length) await db.update(schema.orgTerms).set(set).where(eq(schema.orgTerms.id, id))
  return loadTerm(id)
}

export async function deleteTerm(id: string): Promise<void> {
  await db.delete(schema.orgTerms).where(eq(schema.orgTerms.id, id))
}

export async function createPlan(input: MembershipPlanCreate): Promise<MembershipPlan> {
  const id = randomUUID()
  await db.insert(schema.membershipPlans).values({
    id,
    orgId: input.orgId,
    name: input.name,
    description: input.description ?? null,
    color: input.color ?? null,
    status: input.status ?? 'active',
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await loadPlan(id))!
}

export async function updatePlan(id: string, patch: MembershipPlanPatch): Promise<MembershipPlan | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.description !== undefined) set.description = patch.description
  if (patch.color !== undefined) set.color = patch.color
  if (patch.status !== undefined) set.status = patch.status
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length) await db.update(schema.membershipPlans).set(set).where(eq(schema.membershipPlans.id, id))
  return loadPlan(id)
}

export async function deletePlan(id: string): Promise<void> {
  await db.delete(schema.membershipPlans).where(eq(schema.membershipPlans.id, id))
}

// ── Plan duration options (writes) ──
// The base plan row is written above; these manage the plan's duration options
// (1/3/6 month, still the same plan). The repo owns the id; price is a DECIMAL column
// (raw string|number passes straight through); auto_renew is notNull with no default,
// so it's always written. Re-read after write through the same mapper as listPlans.
async function loadPlanOption(id: string): Promise<MembershipPlanOption | null> {
  const [r] = await db
    .select()
    .from(schema.membershipPlanOptions)
    .where(eq(schema.membershipPlanOptions.id, id))
    .limit(1)
  return r ? toPlanOption(r) : null
}

export async function createPlanOption(input: MembershipPlanOptionCreate): Promise<MembershipPlanOption> {
  const id = randomUUID()
  await db.insert(schema.membershipPlanOptions).values({
    id,
    planId: input.planId,
    name: input.name ?? null,
    periodUnit: input.periodUnit,
    periodCount: input.periodCount ?? 1,
    price: input.price ?? null,
    autoRenew: input.autoRenew ?? false,
    sortOrder: input.sortOrder ?? 0,
  } as any)
  return (await loadPlanOption(id))!
}

export async function updatePlanOption(
  id: string,
  patch: MembershipPlanOptionPatch,
): Promise<MembershipPlanOption | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.periodUnit !== undefined) set.periodUnit = patch.periodUnit
  if (patch.periodCount !== undefined) set.periodCount = patch.periodCount
  if (patch.price !== undefined) set.price = patch.price
  if (patch.autoRenew !== undefined) set.autoRenew = patch.autoRenew
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (Object.keys(set).length)
    await db.update(schema.membershipPlanOptions).set(set).where(eq(schema.membershipPlanOptions.id, id))
  return loadPlanOption(id)
}

// Bulk-delete a plan's options by id, scoped by planId (tenant safety — the option
// rows have no org_id; they belong to a plan the caller owns).
export async function deletePlanOptions(planId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await db
    .delete(schema.membershipPlanOptions)
    .where(and(eq(schema.membershipPlanOptions.planId, planId), inArray(schema.membershipPlanOptions.id, ids)))
}

// ── Term sets (writes) ──
async function loadTermSet(id: string): Promise<TermSet | null> {
  const [r] = await db.select().from(schema.termSets).where(eq(schema.termSets.id, id)).limit(1)
  return r ? toTermSet(r) : null
}

export async function createTermSet(input: TermSetCreate): Promise<TermSet> {
  const id = randomUUID()
  await db.insert(schema.termSets).values({
    id,
    orgId: input.orgId,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    sportId: input.sportId ?? null,
    // json column — RAW array (or null = whole club).
    locationIds: input.locationIds ?? null,
  } as any)
  return (await loadTermSet(id))!
}

export async function updateTermSet(id: string, patch: TermSetPatch): Promise<TermSet | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder
  if (patch.sportId !== undefined) set.sportId = patch.sportId
  if (patch.locationIds !== undefined) set.locationIds = patch.locationIds
  if (Object.keys(set).length) await db.update(schema.termSets).set(set).where(eq(schema.termSets.id, id))
  return loadTermSet(id)
}

export async function deleteTermSet(id: string): Promise<void> {
  // Terms fall back to the default set (set_id → null via FK on delete set null).
  await db.delete(schema.termSets).where(eq(schema.termSets.id, id))
}

// ── Group billing (member_group_terms + member_group_plans) ──
// What one group offers: the terms it runs in (with a per-term fee) + the plans it
// links. Two small reads joined into one projection. member_group_terms/plans have
// no org_id — scoped by groupId (the caller owns the group).
export async function loadGroupBilling(groupId: string): Promise<GroupBilling> {
  const [terms, plans] = await Promise.all([
    db
      .select({ termId: schema.memberGroupTerms.termId, fee: schema.memberGroupTerms.fee })
      .from(schema.memberGroupTerms)
      .where(eq(schema.memberGroupTerms.groupId, groupId)),
    db
      .select({ planId: schema.memberGroupPlans.planId })
      .from(schema.memberGroupPlans)
      .where(eq(schema.memberGroupPlans.groupId, groupId)),
  ])
  return {
    terms: terms.map((t) => ({ termId: t.termId, fee: (t.fee as any) ?? null })),
    plans: plans.map((p) => ({ planId: p.planId })),
  }
}

// Replace a group's billing links (delete-then-insert both tables). termFees =
// [{termId, fee}], planIds = plan ids. Scoped by groupId.
export async function saveGroupBilling(
  groupId: string,
  termFees: { termId: string; fee: string | number | null }[],
  planIds: string[],
): Promise<GroupBilling> {
  await db.delete(schema.memberGroupTerms).where(eq(schema.memberGroupTerms.groupId, groupId))
  await db.delete(schema.memberGroupPlans).where(eq(schema.memberGroupPlans.groupId, groupId))
  for (const t of termFees) {
    await db.insert(schema.memberGroupTerms).values({
      id: randomUUID(),
      groupId,
      termId: t.termId,
      fee: t.fee ?? null,
    } as any)
  }
  for (const planId of planIds) {
    await db.insert(schema.memberGroupPlans).values({ id: randomUUID(), groupId, planId } as any)
  }
  return loadGroupBilling(groupId)
}

// ── Membership entitlements (writes) ──
/** Every entitlement in an org (for coverage resolution across all memberships). */
export async function listEntitlementsByOrg(orgId: string): Promise<MembershipEntitlement[]> {
  const rows = await db
    .select()
    .from(schema.membershipEntitlements)
    .where(eq(schema.membershipEntitlements.orgId, orgId))
  return rows.map(toEntitlement)
}

/** Replace what one membership includes (delete-then-insert). */
export async function saveEntitlements(
  orgId: string,
  membershipGroupId: string,
  rows: MembershipEntitlementInput[],
): Promise<MembershipEntitlement[]> {
  await db
    .delete(schema.membershipEntitlements)
    .where(eq(schema.membershipEntitlements.membershipGroupId, membershipGroupId))
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    await db.insert(schema.membershipEntitlements).values({
      id: randomUUID(),
      orgId,
      membershipGroupId,
      targetType: r.targetType,
      targetId: r.targetId,
      benefitType: r.benefitType ?? 'included',
      benefitValue: r.benefitValue ?? null,
      sortOrder: i,
    } as any)
  }
  return listEntitlements(membershipGroupId)
}
