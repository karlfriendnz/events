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
import { and, asc, desc, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Discount,
  BookingDiscount,
  XeroConnection,
  DiscountCreate,
  DiscountPatch,
  FeeComponent,
  Addon,
  AddonCreate,
  ReportingBundle,
  AttendanceSession,
  CustomReport,
  CustomReportCreate,
  CustomReportPatch,
  ReportPerson,
  XeroConnectionMappingPatch,
  BankAccount,
  BankAccountCreate,
  BankAccountPatch,
  PersonRegistration,
  OutstandingSummary,
  RegistrationTransaction,
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

// ── json normalisers (a json() column may hand back a parsed value OR a string) ──
function asArr(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return Array.isArray(p) ? p : []
    } catch {
      return []
    }
  }
  return []
}
function asRecord(v: unknown): Record<string, any> {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v)
      return p && typeof p === 'object' && !Array.isArray(p) ? p : {}
    } catch {
      return {}
    }
  }
  return {}
}

// ── Fee components ───────────────────────────────────────────────────────────
// CROSS-DOMAIN READ: `fee_components` is finances' concern, but it has no org_id,
// so it's scoped by joining `events` (the same idiom `listDiscounts` uses above).
/** Every fee component in an org (via its event), in fee sort order. */
export async function listFeeComponents(orgId: string): Promise<FeeComponent[]> {
  const rows = await db
    .select({ f: schema.feeComponents, eid: schema.events.id, etitle: schema.events.title })
    .from(schema.feeComponents)
    .innerJoin(schema.events, eq(schema.feeComponents.eventId, schema.events.id))
    .where(eq(schema.events.orgId, orgId))
    .orderBy(asc(schema.feeComponents.sortOrder))
  return rows.map((r) => ({
    id: r.f.id,
    eventId: r.f.eventId ?? null,
    name: r.f.name ?? null,
    amount: r.f.amount ?? null,
    xeroCode: r.f.xeroCode ?? null,
    isLocked: !!r.f.isLocked,
    depositPercent: r.f.depositPercent ?? null,
    sortOrder: r.f.sortOrder ?? null,
    event: { id: r.eid, title: r.etitle ?? null },
  }))
}

// ── Add-ons ──────────────────────────────────────────────────────────────────
function toAddon(a: typeof schema.addons.$inferSelect, eid: string, etitle: string | null): Addon {
  return {
    id: a.id,
    eventId: a.eventId ?? null,
    type: a.type ?? null,
    name: a.name ?? null,
    description: a.description ?? null,
    price: a.price ?? null,
    stockLimit: a.stockLimit ?? null,
    sortOrder: a.sortOrder ?? null,
    event: { id: eid, title: etitle },
  }
}

/** Every add-on in an org (via its event), in add-on sort order. */
export async function listAddons(orgId: string): Promise<Addon[]> {
  const rows = await db
    .select({ a: schema.addons, eid: schema.events.id, etitle: schema.events.title })
    .from(schema.addons)
    .innerJoin(schema.events, eq(schema.addons.eventId, schema.events.id))
    .where(eq(schema.events.orgId, orgId))
    .orderBy(asc(schema.addons.sortOrder))
  return rows.map((r) => toAddon(r.a, r.eid, r.etitle ?? null))
}

/** Create an add-on on an event. The repo owns the id. */
export async function createAddon(input: AddonCreate): Promise<Addon | null> {
  const id = randomUUID()
  await db.insert(schema.addons).values({
    id,
    eventId: input.eventId,
    name: input.name,
    type: input.type ?? 'OBJECT',
    price: input.price ?? '0',
    stockLimit: input.stockLimit ?? null,
    description: input.description ?? null,
  } as any)
  const [r] = await db
    .select({ a: schema.addons, eid: schema.events.id, etitle: schema.events.title })
    .from(schema.addons)
    .innerJoin(schema.events, eq(schema.addons.eventId, schema.events.id))
    .where(eq(schema.addons.id, id))
    .limit(1)
  return r ? toAddon(r.a, r.eid, r.etitle ?? null) : null
}

export async function deleteAddon(id: string): Promise<void> {
  await db.delete(schema.addons).where(eq(schema.addons.id, id))
}

// ── Org currency (a minimal read the finances/reporting screens format with) ──
/** The org's ISO currency code (defaults NZD when unset). */
export async function getOrgCurrency(orgId: string): Promise<string> {
  const [o] = await db
    .select({ currency: schema.organisations.currency })
    .from(schema.organisations)
    .where(eq(schema.organisations.id, orgId))
    .limit(1)
  return o?.currency || 'NZD'
}

// ── Reporting rollup ─────────────────────────────────────────────────────────
// CROSS-DOMAIN READ: events + categories + invitees, aggregated for the /reporting
// dashboard. The page does its own status/category grouping, so this returns the
// event rows (with category name/color) and the raw invitee status list.
export async function reportingBundle(orgId: string): Promise<ReportingBundle> {
  const eventRows = await db
    .select({
      id: schema.events.id,
      title: schema.events.title,
      style: schema.events.style,
      status: schema.events.status,
      startAt: schema.events.startAt,
      endAt: schema.events.endAt,
      isAllDay: schema.events.isAllDay,
      catName: schema.categories.name,
      catColor: schema.categories.color,
    })
    .from(schema.events)
    .leftJoin(schema.categories, eq(schema.events.categoryId, schema.categories.id))
    .where(eq(schema.events.orgId, orgId))
    .orderBy(asc(schema.events.startAt))

  const inviteeRows = await db
    .select({ eventId: schema.invitees.eventId, status: schema.invitees.status })
    .from(schema.invitees)
    .innerJoin(schema.events, eq(schema.invitees.eventId, schema.events.id))
    .where(eq(schema.events.orgId, orgId))

  return {
    events: eventRows.map((e) => ({
      id: e.id,
      title: e.title ?? null,
      style: e.style ?? null,
      status: e.status ?? null,
      startAt: toIso(e.startAt),
      endAt: toIso(e.endAt),
      isAllDay: !!e.isAllDay,
      category: e.catName != null || e.catColor != null ? { name: e.catName ?? null, color: e.catColor ?? null } : null,
    })),
    invitees: inviteeRows.map((i) => ({ eventId: i.eventId ?? null, status: i.status })),
  }
}

// ── Attendance sessions ──────────────────────────────────────────────────────
// CROSS-DOMAIN READ: group-linked training events in a date window, with the group
// (member_groups) and bookable name resolved. `member_group_id NOT NULL` is the
// canonical "training event" filter (independent of event style).
export async function attendanceSessions(orgId: string, from: string, to: string): Promise<AttendanceSession[]> {
  const fromD = new Date(from)
  const toD = new Date(to)
  const rows = await db
    .select({
      eventId: schema.events.id,
      startAt: schema.events.startAt,
      endAt: schema.events.endAt,
      locationType: schema.events.locationType,
      bookableId: schema.events.bookableId,
      address: schema.events.address,
      meetingLink: schema.events.meetingLink,
      groupName: schema.memberGroups.name,
      groupColor: schema.memberGroups.color,
      locationId: schema.memberGroups.locationId,
    })
    .from(schema.events)
    .leftJoin(schema.memberGroups, eq(schema.events.memberGroupId, schema.memberGroups.id))
    .where(
      and(
        eq(schema.events.orgId, orgId),
        isNotNull(schema.events.memberGroupId),
        gte(schema.events.startAt, fromD),
        lt(schema.events.startAt, toD),
      ),
    )
    .orderBy(asc(schema.events.startAt))

  // Resolve bookable names in one query.
  const bookableIds = Array.from(new Set(rows.map((r) => r.bookableId).filter((x): x is string => !!x)))
  const names: Record<string, string> = {}
  if (bookableIds.length) {
    const bkbls = await db
      .select({ id: schema.bookables.id, name: schema.bookables.name })
      .from(schema.bookables)
      .where(inArray(schema.bookables.id, bookableIds))
    for (const b of bkbls) names[b.id] = b.name
  }

  return rows.map((r) => ({
    eventId: r.eventId,
    startAt: toIso(r.startAt),
    endAt: toIso(r.endAt),
    locationType: r.locationType ?? null,
    bookableName: r.bookableId ? names[r.bookableId] ?? null : null,
    address: r.address ?? null,
    meetingLink: r.meetingLink ?? null,
    groupName: r.groupName ?? null,
    groupColor: r.groupColor ?? null,
    locationId: r.locationId ?? null,
  }))
}

// ── Custom reports (table `custom_reports`) ──────────────────────────────────
function toCustomReport(r: typeof schema.customReports.$inferSelect): CustomReport {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    config: asRecord(r.config),
    sortOrder: r.sortOrder ?? 0,
  }
}

/** Every custom report for an org, in sort order then name. */
export async function listCustomReports(orgId: string): Promise<CustomReport[]> {
  const rows = await db
    .select()
    .from(schema.customReports)
    .where(eq(schema.customReports.orgId, orgId))
    .orderBy(asc(schema.customReports.sortOrder), asc(schema.customReports.name))
  return rows.map(toCustomReport)
}

/** One custom report by id, or null. */
export async function getCustomReport(id: string): Promise<CustomReport | null> {
  const [r] = await db.select().from(schema.customReports).where(eq(schema.customReports.id, id)).limit(1)
  return r ? toCustomReport(r) : null
}

export async function createCustomReport(orgId: string, input: CustomReportCreate): Promise<CustomReport> {
  const id = randomUUID()
  // json column: pass the plain JS value (drizzle serialises it) — never stringify.
  await db.insert(schema.customReports).values({ id, orgId, name: input.name, config: input.config } as any)
  return (await getCustomReport(id))!
}

export async function updateCustomReport(id: string, patch: CustomReportPatch): Promise<CustomReport | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.config !== undefined) set.config = patch.config
  if (Object.keys(set).length) await db.update(schema.customReports).set(set).where(eq(schema.customReports.id, id))
  return getCustomReport(id)
}

export async function deleteCustomReport(id: string): Promise<void> {
  await db.delete(schema.customReports).where(eq(schema.customReports.id, id))
}

// ── Report run-data ──────────────────────────────────────────────────────────
// CROSS-DOMAIN READ: the people a custom report filters over. Returns the SNAKE_CASE
// field vocabulary the saved-config filter engine expects (see the contract note),
// plus each person's union of member-group positions.
export async function reportPeople(orgId: string): Promise<ReportPerson[]> {
  const persons = await db
    .select({
      id: schema.persons.id,
      firstName: schema.persons.firstName,
      lastName: schema.persons.lastName,
      email: schema.persons.email,
      phone: schema.persons.phone,
      dob: schema.persons.dob,
      gender: schema.persons.gender,
      membershipType: schema.persons.membershipType,
      personType: schema.persons.personType,
      personTypes: schema.persons.personTypes,
      customFields: schema.persons.customFields,
      photoUrl: schema.persons.photoUrl,
    })
    .from(schema.persons)
    .where(eq(schema.persons.orgId, orgId))

  // Positions live on member_group_memberships (no org_id there) — scope by joined group.
  const mships = await db
    .select({ personId: schema.memberGroupMemberships.personId, positions: schema.memberGroupMemberships.positions })
    .from(schema.memberGroupMemberships)
    .innerJoin(schema.memberGroups, eq(schema.memberGroupMemberships.groupId, schema.memberGroups.id))
    .where(eq(schema.memberGroups.orgId, orgId))

  const posByPerson: Record<string, string[]> = {}
  for (const m of mships) {
    if (!m.personId) continue
    const arr = (posByPerson[m.personId] ??= [])
    for (const p of asArr(m.positions)) if (p && !arr.includes(p)) arr.push(p)
  }

  return persons.map((p) => ({
    id: p.id,
    first_name: p.firstName ?? null,
    last_name: p.lastName ?? null,
    email: p.email ?? null,
    phone: p.phone ?? null,
    dob: p.dob != null ? String(p.dob) : null,
    gender: p.gender ?? null,
    membership_type: p.membershipType ?? null,
    person_type: p.personType ?? null,
    person_types: asArr(p.personTypes),
    custom_fields: asRecord(p.customFields),
    photo_url: p.photoUrl ?? null,
    __positions: posByPerson[p.id] ?? [],
  }))
}

/** Distinct member-group positions across an org (for the report field picker). */
export async function reportPositions(orgId: string): Promise<string[]> {
  const mships = await db
    .select({ positions: schema.memberGroupMemberships.positions })
    .from(schema.memberGroupMemberships)
    .innerJoin(schema.memberGroups, eq(schema.memberGroupMemberships.groupId, schema.memberGroups.id))
    .where(eq(schema.memberGroups.orgId, orgId))
  const set = new Set<string>()
  for (const m of mships) for (const p of asArr(m.positions)) if (p) set.add(p)
  return [...set].sort()
}

// ── Xero connection mapping update ──
// Patch just the mapping columns on the org's single xero_connections row (never
// tokens). json feeAccounts takes the raw JS value (no JSON.stringify).
export async function updateXeroConnectionMapping(patch: XeroConnectionMappingPatch): Promise<XeroConnection | null> {
  const set: Record<string, any> = { updatedAt: new Date() }
  if (patch.bankAccountCode !== undefined) set.bankAccountCode = patch.bankAccountCode
  if (patch.bankAccountName !== undefined) set.bankAccountName = patch.bankAccountName
  if (patch.taxType !== undefined) set.taxType = patch.taxType
  if (patch.salesAccountCode !== undefined) set.salesAccountCode = patch.salesAccountCode
  if (patch.feeAccounts !== undefined) set.feeAccounts = patch.feeAccounts
  await db.update(schema.xeroConnections).set(set as any).where(eq(schema.xeroConnections.orgId, patch.orgId))
  return getXeroConnection(patch.orgId)
}

// ── Bank accounts (Settings payment defaults) ──
function toBankAccount(r: typeof schema.bankAccounts.$inferSelect): BankAccount {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    details: r.details ?? null,
    isDefault: r.isDefault === true || (r.isDefault as any) === 1,
    sortOrder: r.sortOrder,
  }
}

/** The org's bank accounts, in sort order. */
export async function listBankAccounts(orgId: string): Promise<BankAccount[]> {
  const rows = await db
    .select()
    .from(schema.bankAccounts)
    .where(eq(schema.bankAccounts.orgId, orgId))
    .orderBy(asc(schema.bankAccounts.sortOrder))
  return rows.map(toBankAccount)
}

async function getBankAccount(id: string): Promise<BankAccount | null> {
  const [r] = await db.select().from(schema.bankAccounts).where(eq(schema.bankAccounts.id, id)).limit(1)
  return r ? toBankAccount(r) : null
}

// Only ONE account can be the default per org — clear the others when one is set.
async function clearDefault(orgId: string): Promise<void> {
  await db.update(schema.bankAccounts).set({ isDefault: false } as any).where(eq(schema.bankAccounts.orgId, orgId))
}

export async function createBankAccount(input: BankAccountCreate): Promise<BankAccount> {
  const existing = await db
    .select({ id: schema.bankAccounts.id })
    .from(schema.bankAccounts)
    .where(eq(schema.bankAccounts.orgId, input.orgId))
  if (input.isDefault) await clearDefault(input.orgId)
  const id = randomUUID()
  await db.insert(schema.bankAccounts).values({
    id,
    orgId: input.orgId,
    name: input.name,
    details: input.details ?? null,
    isDefault: input.isDefault ?? false,
    sortOrder: existing.length,
  } as any)
  return (await getBankAccount(id))!
}

/** Patch a bank account. Tenant-scoped (id AND org_id). Setting isDefault true clears
 *  the org's other defaults first. */
export async function updateBankAccount(id: string, patch: BankAccountPatch): Promise<BankAccount | null> {
  if (patch.isDefault) await clearDefault(patch.orgId)
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.details !== undefined) set.details = patch.details
  if (patch.isDefault !== undefined) set.isDefault = patch.isDefault
  if (Object.keys(set).length) {
    await db
      .update(schema.bankAccounts)
      .set(set as any)
      .where(and(eq(schema.bankAccounts.id, id), eq(schema.bankAccounts.orgId, patch.orgId)))
  }
  return getBankAccount(id)
}

export async function deleteBankAccount(id: string, orgId: string): Promise<void> {
  await db.delete(schema.bankAccounts).where(and(eq(schema.bankAccounts.id, id), eq(schema.bankAccounts.orgId, orgId)))
}

// ── Person financials (profile Financials widget + member portal) ──
// registrations has no org_id — a child of events. A person's registrations are read
// by person_id; the org-wide outstanding rollup joins events for org scope.
// Money columns are decimals — mysql2 returns strings; coerce to number here.
const num = (v: unknown): number => (v == null ? 0 : Number(v)) || 0

/** One person's registrations (money owed/paid) — profile Financials + member portal. */
export async function listRegistrationsForPerson(personId: string): Promise<PersonRegistration[]> {
  if (!personId) return []
  const rows = await db
    .select({
      id: schema.registrations.id,
      personId: schema.registrations.personId,
      status: schema.registrations.status,
      totalAmount: schema.registrations.totalAmount,
      paidAmount: schema.registrations.paidAmount,
    })
    .from(schema.registrations)
    .where(eq(schema.registrations.personId, personId))
  return rows.map((r) => ({
    id: r.id,
    personId: r.personId ?? null,
    status: r.status,
    totalAmount: num(r.totalAmount),
    paidAmount: num(r.paidAmount),
  }))
}

/** The org-wide outstanding rollup: Σ max(0, total − paid) + count of registrations
 *  still carrying a balance. Joins events for org scope (registrations has no org_id). */
export async function outstandingByOrg(orgId: string): Promise<OutstandingSummary> {
  const rows = await db
    .select({ total: schema.registrations.totalAmount, paid: schema.registrations.paidAmount })
    .from(schema.registrations)
    .innerJoin(schema.events, eq(schema.registrations.eventId, schema.events.id))
    .where(eq(schema.events.orgId, orgId))
  let owed = 0, count = 0
  for (const r of rows) {
    const due = Math.max(0, num(r.total) - num(r.paid))
    if (due > 0) { owed += due; count++ }
  }
  return { owed, count }
}

/** Transaction refs (Xero invoice id) for a set of registrations — the profile
 *  Financials rows surface the invoice id. Empty in → empty out. */
export async function listTransactionsForRegistrations(regIds: string[]): Promise<RegistrationTransaction[]> {
  if (!regIds.length) return []
  const rows = await db
    .select({
      registrationId: schema.transactions.registrationId,
      xeroInvoiceId: schema.transactions.xeroInvoiceId,
    })
    .from(schema.transactions)
    .where(inArray(schema.transactions.registrationId, regIds))
  return rows.map((r) => ({ registrationId: r.registrationId, xeroInvoiceId: r.xeroInvoiceId ?? null }))
}
