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
import { asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '../client'
import type { Discount, BookingDiscount, XeroConnection } from '../../../shared/contracts/finance'

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
