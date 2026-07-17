// The repository: the ONLY code that knows how discounts, booking discounts and the
// Xero connection are stored. It turns DB rows into domain objects (the contract
// shape) and back. Nitro routes call these functions; they never touch Drizzle or
// the DB directly. When the backend team's MySQL API replaces this, only this file
// changes — routes, composables and UI are untouched.
//
// json handling: conditions / eligibility / fee_accounts are `json` columns. mysql2
// usually hands them back already parsed, but a driver/config can return the raw
// string — `asJson` normalises either (and never throws), so the domain always sees
// a real JS value.
//
// scoping: `discounts` has no org_id of its own — a discount belongs to an EVENT, so
// listing by org joins through `events` and takes org_id from there. `booking_discounts`
// and `xero_connections` carry org_id directly.
//
// timestamps: MySQL returns Date objects; `toIso` serialises to ISO 8601 and lets
// null pass through, so a nullable validity date stays null in the contract.
//
// money: `modifier_value` is a decimal — mysql2 returns it as a string; it is passed
// through unchanged (the contract accepts string|number) rather than lossily coerced.
import { randomUUID } from 'node:crypto'
import { asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Discount,
  BookingDiscount,
  XeroConnection,
  DiscountCreate,
  DiscountPatch,
} from '../../../shared/contracts/finance'

// Coerce a json column into its parsed value, leaving non-string payloads as-is.
function asJson(v: unknown): any {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return v
    }
  }
  return v ?? null
}

// Serialise a timestamp to ISO 8601; null/undefined pass through as null.
function toIso(v: unknown): string | null {
  if (v == null) return null
  const d = v instanceof Date ? v : new Date(v as any)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

// A discount row + the org_id resolved from its linked event.
function toDiscount(r: typeof schema.discounts.$inferSelect, orgId: string): Discount {
  return {
    id: r.id,
    orgId,
    eventId: r.eventId ?? null,
    type: r.type,
    name: r.name,
    code: r.code ?? null,
    formText: r.formText ?? null,
    modifierType: r.modifierType,
    modifierValue: r.modifierValue ?? null,
    applyTo: r.applyTo,
    conditions: asJson(r.conditions),
    eligibility: asJson(r.eligibility),
    usageCap: r.usageCap ?? null,
    perUserCap: r.perUserCap ?? null,
    minSessions: r.minSessions ?? null,
    linkedEventId: r.linkedEventId ?? null,
    validFrom: toIso(r.validFrom),
    expiresAt: toIso(r.expiresAt),
    isActive: !!r.isActive,
  }
}

function toBookingDiscount(r: typeof schema.bookingDiscounts.$inferSelect): BookingDiscount {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    formText: r.formText ?? null,
    modifierType: r.modifierType,
    modifierValue: r.modifierValue ?? null,
    applyTo: r.applyTo,
    conditions: asJson(r.conditions),
    validFrom: toIso(r.validFrom),
    validUntil: toIso(r.validUntil),
    maxUses: r.maxUses ?? null,
    usesCount: r.usesCount,
    isActive: !!r.isActive,
  }
}

function toXeroConnection(r: typeof schema.xeroConnections.$inferSelect): XeroConnection {
  return {
    id: r.id,
    orgId: r.orgId,
    tenantId: r.tenantId,
    tenantName: r.tenantName ?? null,
    salesAccountCode: r.salesAccountCode ?? null,
    bankAccountCode: r.bankAccountCode ?? null,
    bankAccountName: r.bankAccountName ?? null,
    taxType: r.taxType ?? null,
    feeAccounts: asJson(r.feeAccounts),
    status: r.status,
    connectedAt: toIso(r.connectedAt),
  }
}

/** Every event discount in an org (scoped via each discount's event), author order. */
export async function listDiscounts(orgId: string): Promise<Discount[]> {
  const rows = await db
    .select({ d: schema.discounts })
    .from(schema.discounts)
    .innerJoin(schema.events, eq(schema.discounts.eventId, schema.events.id))
    .where(eq(schema.events.orgId, orgId))
    .orderBy(desc(schema.discounts.createdAt))
  return rows.map((r) => toDiscount(r.d, orgId))
}

// Resolve the org_id a discount belongs to via its linked event (the table has no
// org_id of its own). Null/absent event → '' (a discount created without an event).
async function orgIdForEvent(eventId: string | null): Promise<string> {
  if (!eventId) return ''
  const [e] = await db
    .select({ orgId: schema.events.orgId })
    .from(schema.events)
    .where(eq(schema.events.id, eventId))
    .limit(1)
  return e?.orgId ?? ''
}

/** One event discount by id, or null — org resolved from its linked event. */
export async function getDiscount(id: string): Promise<Discount | null> {
  const [r] = await db.select().from(schema.discounts).where(eq(schema.discounts.id, id)).limit(1)
  if (!r) return null
  return toDiscount(r, await orgIdForEvent(r.eventId ?? null))
}

// ── Writes ──
// The repo owns the id (MySQL can't default a uuid). `conditions`/`eligibility` json
// columns are passed as PLAIN JS values — drizzle's json() serialises them; DON'T
// JSON.stringify first or it stores a double-encoded string. Timestamp columns
// (valid_from / expires_at) take a Date, so an ISO string is coerced. `as any`
// mirrors the app's insert idiom (the first-pass schema over-requires notNull
// columns the DB defaults). `discounts` has no org_id — org comes from the event.
export async function createDiscount(input: DiscountCreate): Promise<Discount> {
  const id = randomUUID()
  await db.insert(schema.discounts).values({
    id,
    eventId: input.eventId ?? null,
    type: input.type ?? 'discount',
    name: input.name,
    code: input.code ?? null,
    modifierType: input.modifierType ?? 'PERCENT',
    modifierValue: input.modifierValue ?? '0',
    usageCap: input.usageCap ?? null,
    perUserCap: input.perUserCap ?? null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    eligibility: input.eligibility ?? null,
    linkedEventId: input.linkedEventId ?? null,
    minSessions: input.minSessions ?? null,
    isActive: input.isActive ?? true,
    formText: input.formText ?? null,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    applyTo: input.applyTo ?? 'registration_total',
    conditions: input.conditions ?? [],
  } as any)
  return (await getDiscount(id))!
}

export async function updateDiscount(id: string, patch: DiscountPatch): Promise<Discount | null> {
  const set: Record<string, any> = {}
  if (patch.eventId !== undefined) set.eventId = patch.eventId
  if (patch.type !== undefined) set.type = patch.type
  if (patch.name !== undefined) set.name = patch.name
  if (patch.code !== undefined) set.code = patch.code
  if (patch.modifierType !== undefined) set.modifierType = patch.modifierType
  if (patch.modifierValue !== undefined) set.modifierValue = patch.modifierValue
  if (patch.usageCap !== undefined) set.usageCap = patch.usageCap
  if (patch.perUserCap !== undefined) set.perUserCap = patch.perUserCap
  if (patch.expiresAt !== undefined) set.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null
  if (patch.eligibility !== undefined) set.eligibility = patch.eligibility
  if (patch.linkedEventId !== undefined) set.linkedEventId = patch.linkedEventId
  if (patch.minSessions !== undefined) set.minSessions = patch.minSessions
  if (patch.isActive !== undefined) set.isActive = patch.isActive
  if (patch.formText !== undefined) set.formText = patch.formText
  if (patch.validFrom !== undefined) set.validFrom = patch.validFrom ? new Date(patch.validFrom) : null
  if (patch.applyTo !== undefined) set.applyTo = patch.applyTo
  if (patch.conditions !== undefined) set.conditions = patch.conditions
  if (Object.keys(set).length) await db.update(schema.discounts).set(set).where(eq(schema.discounts.id, id))
  return getDiscount(id)
}

export async function deleteDiscount(id: string): Promise<void> {
  await db.delete(schema.discounts).where(eq(schema.discounts.id, id))
}

/** Every booking discount an org has defined, newest first. */
export async function listBookingDiscounts(orgId: string): Promise<BookingDiscount[]> {
  const rows = await db
    .select()
    .from(schema.bookingDiscounts)
    .where(eq(schema.bookingDiscounts.orgId, orgId))
    .orderBy(asc(schema.bookingDiscounts.name))
  return rows.map(toBookingDiscount)
}

/** An org's Xero connection — a per-org singleton; null when not connected. */
export async function getXeroConnection(orgId: string): Promise<XeroConnection | null> {
  const rows = await db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.orgId, orgId))
    .limit(1)
  return rows.length ? toXeroConnection(rows[0]) : null
}
