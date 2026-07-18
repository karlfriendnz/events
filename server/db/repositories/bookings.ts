// The repository: the ONLY code that knows how the bookings domain is stored —
// bookables, their modes/configurations/availability/access links, activities +
// their modes/scope/required-items, bookings + their items, booking discounts, and
// the org-wide door/light catalogue. It turns DB rows into domain objects (the
// contract shape) and back. Nitro routes call these functions; they never touch
// Drizzle or the DB directly. When the backend team's MySQL API replaces this, only
// this file changes — routes, composables and UI are untouched.
//
// json handling: the many json columns (a bookable's features/images/categories/
// sports, a mode's pricing/addons/payment_options, an availability rule's slots) are
// `json` in MySQL. mysql2 usually hands them back already parsed, but a driver/config
// can return the raw string — asArray/asObj normalise either (and never throw), so
// the domain always sees a real JS value. On WRITE, json columns take RAW JS values
// (never JSON.stringify — Drizzle json() double-encodes).
import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gt, gte, inArray, lt, lte, ne } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  Bookable, BookableCreate, BookablePatch,
  Activity, ActivityCreate, ActivityPatch,
  ActivityMode, ActivityModeCreate, ActivityModePatch,
  BookableMode, BookableModeInput,
  AvailabilityRule, AvailabilityRuleCreate, AvailabilityRulePatch,
  BookableConfigurationFull,
  Door, DoorCreate, DoorPatch,
  LightZone, LightZoneCreate, LightZonePatch,
  BookingDiscount,
  ActivityModeBookable, ActivityModeResource, ActivityModeRequiredItem, ActivityBookable,
  Booking, BookingCreate, BookingPatch, BookingDetail,
  BookingWindow, BookingWindowCreate, BookingWindowPatch, BookingWindowSlotInput,
} from '../../../shared/contracts/booking'

// ── json / value coercion ──
function asArray(v: unknown): any[] {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}
function asStrArray(v: unknown): string[] { return asArray(v).map((x) => String(x)) }
function asObj(v: unknown): Record<string, any> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, any>
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return p && typeof p === 'object' && !Array.isArray(p) ? p : null } catch { return null }
  }
  return null
}
// A DB timestamp → ISO 8601 string.
function toIso(v: unknown): string {
  const d = v instanceof Date ? v : new Date(v as any)
  return d.toISOString()
}
function toIsoN(v: unknown): string | null {
  if (v == null) return null
  return toIso(v)
}
// A DB date column → 'YYYY-MM-DD' string (Date object or already a string).
function toDateStr(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v)
}
// time columns pass through as strings.
function toStrN(v: unknown): string | null {
  return v == null ? null : String(v)
}
function toNum(v: unknown): number | null {
  return v == null ? null : Number(v)
}

// ── mappers (row → domain) ──
function toBookable(r: typeof schema.bookables.$inferSelect): Bookable {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    internalName: r.internalName ?? null,
    type: r.type,
    status: r.status,
    parentId: r.parentId ?? null,
    masterId: r.masterId ?? null,
    isMaster: r.isMaster,
    isSlaveAutoAssign: r.isSlaveAutoAssign,
    isPublic: r.isPublic,
    isNetwork: r.isNetwork,
    maxConcurrent: r.maxConcurrent,
    location: r.location ?? null,
    showLocation: r.showLocation,
    description: r.description ?? null,
    features: asStrArray(r.features),
    rules: r.rules ?? null,
    images: asArray(r.images),
    categories: asStrArray(r.categories),
    sports: asStrArray(r.sports),
    customFields: asObj(r.customFields),
    sortOrder: r.sortOrder,
    itemCategory: r.itemCategory ?? null,
    defaultBookingView: r.defaultBookingView ?? null,
    closedFrom: toDateStr(r.closedFrom),
    closedUntil: toDateStr(r.closedUntil),
    closureReason: r.closureReason ?? null,
    customizedSections: asArray(r.customizedSections),
    mainImage: r.mainImage ?? null,
    sponsorImage: r.sponsorImage ?? null,
    showInMenu: r.showInMenu,
    sections: asStrArray(r.sections),
    spaceType: r.spaceType ?? null,
    bookingLimitType: r.bookingLimitType,
    bookingLimitCount: r.bookingLimitCount ?? null,
    disallowConcurrent: r.disallowConcurrent,
    disallowConsecutive: r.disallowConsecutive,
    allowModesWithOthers: r.allowModesWithOthers,
    allowSubVenues: r.allowSubVenues,
    autoResolveChildren: r.autoResolveChildren,
    accessEnabled: r.accessEnabled,
    accessCodeDelivery: r.accessCodeDelivery,
    accessCodeLength: r.accessCodeLength,
    accessUnlockBeforeMins: r.accessUnlockBeforeMins,
    accessUnlockAfterMins: r.accessUnlockAfterMins,
    lightingRampUpMins: r.lightingRampUpMins,
    lightingRampDownMins: r.lightingRampDownMins,
    lightingLevelPercent: r.lightingLevelPercent,
  }
}

function toActivity(r: typeof schema.activities.$inferSelect): Activity {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    description: r.description ?? null,
    color: r.color,
    icon: r.icon,
    imageUrl: r.imageUrl ?? null,
    status: r.status,
    sortOrder: r.sortOrder,
    requireMode: r.requireMode,
    approvalMode: r.approvalMode,
    bookingWindowDays: r.bookingWindowDays ?? null,
    minNoticeHours: r.minNoticeHours ?? null,
    cancellationWindowHours: r.cancellationWindowHours ?? null,
    minDurationMins: r.minDurationMins ?? null,
    maxDurationMins: r.maxDurationMins ?? null,
    bufferMins: r.bufferMins ?? null,
    areaNameSingular: r.areaNameSingular ?? null,
    areaNamePlural: r.areaNamePlural ?? null,
    bookingsEnabled: r.bookingsEnabled,
    allowMultiSlot: r.allowMultiSlot,
    allowMultiSlotPeak: r.allowMultiSlotPeak,
    allowKiosk: r.allowKiosk,
    allowRecurring: r.allowRecurring,
    allowMemberChanges: r.allowMemberChanges,
    autoRemoveUnpaid: r.autoRemoveUnpaid,
    requireVisitorNames: r.requireVisitorNames,
    hideMemberNames: r.hideMemberNames,
    bookingFlow: r.bookingFlow,
    modeLabel: r.modeLabel,
    modeDisplay: r.modeDisplay,
    assignmentMode: r.assignmentMode,
    staffBookableId: r.staffBookableId ?? null,
  }
}

function toActivityMode(r: typeof schema.activityModes.$inferSelect): ActivityMode {
  return {
    id: r.id,
    activityId: r.activityId,
    name: r.name,
    description: r.description ?? null,
    color: r.color ?? null,
    sortOrder: r.sortOrder,
    imageUrl: r.imageUrl ?? null,
    pricing: asObj(r.pricing),
    addons: asArray(r.addons),
    minPeople: r.minPeople ?? null,
    maxPeople: r.maxPeople ?? null,
    minVisitors: r.minVisitors ?? null,
    maxVisitors: r.maxVisitors ?? null,
    allowVisitors: r.allowVisitors,
    formId: r.formId ?? null,
    defaultBookingView: r.defaultBookingView ?? null,
    paymentOptions: asObj(r.paymentOptions),
    approvalMode: r.approvalMode,
    configurationKey: r.configurationKey ?? null,
    periodUnit: r.periodUnit ?? null,
    periodCount: r.periodCount,
    termType: r.termType,
    periodPrice: r.periodPrice ?? null,
    category: r.category ?? null,
  }
}

function toBookableMode(r: typeof schema.bookableModes.$inferSelect): BookableMode {
  return {
    id: r.id,
    bookableId: r.bookableId,
    name: r.name,
    description: r.description ?? null,
    color: r.color ?? null,
    minPlayers: r.minPlayers ?? null,
    maxPlayers: r.maxPlayers ?? null,
    sortOrder: r.sortOrder,
    pricePerHour: r.pricePerHour ?? null,
    pricePerSlot: r.pricePerSlot ?? null,
    flatFee: r.flatFee ?? null,
    pricePerPerson: r.pricePerPerson ?? null,
  }
}

function toAvailabilityRule(r: typeof schema.availabilityRules.$inferSelect): AvailabilityRule {
  return {
    id: r.id,
    bookableId: r.bookableId,
    name: r.name,
    ruleType: r.ruleType,
    daysOfWeek: asArray(r.daysOfWeek),
    timeFrom: toStrN(r.timeFrom),
    timeTo: toStrN(r.timeTo),
    eligibility: asObj(r.eligibility),
    membershipTypes: asArray(r.membershipTypes),
    groupIds: asArray(r.groupIds),
    sortOrder: r.sortOrder,
    isActive: r.isActive,
    capacityUsed: r.capacityUsed,
    color: r.color,
    priceTiers: asArray(r.priceTiers),
    timeSlots: asArray(r.timeSlots),
    weekInterval: r.weekInterval,
    weekAnchor: toDateStr(r.weekAnchor),
    monthWeek: r.monthWeek ?? null,
    rrule: r.rrule ?? null,
    bookableModeId: r.bookableModeId ?? null,
    activityModeIds: r.activityModeIds == null ? null : asArray(r.activityModeIds),
    maxConcurrent: r.maxConcurrent ?? null,
    validFrom: toDateStr(r.validFrom),
    validUntil: toDateStr(r.validUntil),
    replacedByRuleId: r.replacedByRuleId ?? null,
    inviteeModes: r.inviteeModes == null ? null : asArray(r.inviteeModes),
    inviteeGroups: r.inviteeGroups == null ? null : asArray(r.inviteeGroups),
  }
}

function toDoor(r: typeof schema.doors.$inferSelect): Door {
  return {
    id: r.id, orgId: r.orgId, name: r.name,
    locationNote: r.locationNote ?? null,
    hardwareProvider: r.hardwareProvider ?? null,
    hardwareId: r.hardwareId ?? null,
    defaultUnlockSeconds: r.defaultUnlockSeconds,
    isActive: r.isActive,
  }
}
function toLightZone(r: typeof schema.lightZones.$inferSelect): LightZone {
  return {
    id: r.id, orgId: r.orgId, name: r.name,
    hardwareProvider: r.hardwareProvider ?? null,
    hardwareId: r.hardwareId ?? null,
    defaultLevelPercent: r.defaultLevelPercent,
    isActive: r.isActive,
  }
}

// bookings has NO org_id column — orgId is passed in from the joined bookable.
function toBooking(r: typeof schema.bookings.$inferSelect, orgId: string): Booking {
  return {
    id: r.id,
    orgId,
    bookableId: r.bookableId,
    eventId: r.eventId ?? null,
    sessionId: r.sessionId ?? null,
    type: r.type,
    status: r.status,
    startAt: toIso(r.startAt),
    endAt: toIso(r.endAt),
    notes: r.notes ?? null,
    contactName: r.contactName ?? null,
    contactEmail: r.contactEmail ?? null,
    contactPhone: r.contactPhone ?? null,
    purpose: r.purpose ?? null,
    isAllDay: r.isAllDay,
    activityId: r.activityId ?? null,
    activityModeId: r.activityModeId ?? null,
    bookableModeId: r.bookableModeId ?? null,
    modeId: r.modeId ?? null,
    selectedAddons: asArray(r.selectedAddons),
    attendeeCount: r.attendeeCount ?? null,
    bookingDiscountId: r.bookingDiscountId ?? null,
    discountAmount: r.discountAmount ?? null,
    customFields: asObj(r.customFields),
    parentBookingId: r.parentBookingId ?? null,
    isRecurring: r.isRecurring,
    subjectPersonId: r.subjectPersonId ?? null,
    accessCode: r.accessCode ?? null,
  }
}

// ══ Bookables ══
export async function listBookables(orgId: string): Promise<Bookable[]> {
  const rows = await db.select().from(schema.bookables)
    .where(eq(schema.bookables.orgId, orgId))
    .orderBy(asc(schema.bookables.sortOrder))
  return rows.map(toBookable)
}

export async function getBookable(id: string): Promise<Bookable | null> {
  const [r] = await db.select().from(schema.bookables).where(eq(schema.bookables.id, id)).limit(1)
  return r ? toBookable(r) : null
}

// Build a Drizzle SET object from a (camelCase) patch, keyed by the schema's JS
// property names. `undefined` fields are skipped; json fields pass through raw.
function bookableSet(patch: BookablePatch): Record<string, any> {
  const s: Record<string, any> = {}
  const keys: (keyof BookablePatch)[] = [
    'orgId', 'name', 'internalName', 'type', 'status', 'parentId', 'masterId', 'isMaster',
    'isSlaveAutoAssign', 'isPublic', 'isNetwork', 'maxConcurrent', 'location', 'showLocation',
    'description', 'features', 'rules', 'images', 'categories', 'sports', 'customFields',
    'sortOrder', 'itemCategory', 'defaultBookingView', 'closedFrom', 'closedUntil', 'closureReason',
    'customizedSections', 'mainImage', 'sponsorImage', 'showInMenu', 'sections', 'spaceType',
    'bookingLimitType', 'bookingLimitCount', 'disallowConcurrent', 'disallowConsecutive',
    'allowModesWithOthers', 'allowSubVenues', 'autoResolveChildren', 'accessEnabled',
    'accessCodeDelivery', 'accessCodeLength', 'accessUnlockBeforeMins', 'accessUnlockAfterMins',
    'lightingRampUpMins', 'lightingRampDownMins', 'lightingLevelPercent',
  ]
  for (const k of keys) if (patch[k] !== undefined) s[k] = patch[k]
  return s
}

// The repo owns the id (MySQL can't default a uuid). `as any` on the insert: the
// first-pass schema marks many columns .notNull() (from Postgres) without their
// defaults, so Drizzle over-requires them; the DB (defaults + relaxed mode) fills the
// rest — consistent with the app's (db.from as any) idiom.
export async function createBookable(input: BookableCreate): Promise<Bookable> {
  const id = randomUUID()
  await db.insert(schema.bookables).values({
    id,
    // sensible defaults for the notNull columns the UI may omit
    type: 'VENUE', status: 'ACTIVE', maxConcurrent: 1,
    isMaster: false, isSlaveAutoAssign: false, isPublic: true, isNetwork: false,
    showLocation: false, showInMenu: false, sortOrder: 0,
    bookingLimitType: 'none', disallowConcurrent: false, disallowConsecutive: false,
    allowModesWithOthers: true, allowSubVenues: false, autoResolveChildren: false,
    accessEnabled: false, accessCodeDelivery: 'none', accessCodeLength: 6,
    accessUnlockBeforeMins: 0, accessUnlockAfterMins: 0,
    lightingRampUpMins: 0, lightingRampDownMins: 0, lightingLevelPercent: 100,
    customizedSections: [],
    ...bookableSet(input),
  } as any)
  return (await getBookable(id))!
}

export async function updateBookable(id: string, patch: BookablePatch): Promise<Bookable | null> {
  const s = bookableSet(patch)
  if (Object.keys(s).length) await db.update(schema.bookables).set(s).where(eq(schema.bookables.id, id))
  return getBookable(id)
}

export async function deleteBookable(id: string): Promise<void> {
  await db.delete(schema.bookables).where(eq(schema.bookables.id, id))
}

// ══ Bookable modes ══
export async function listBookableModes(bookableId: string): Promise<BookableMode[]> {
  const rows = await db.select().from(schema.bookableModes)
    .where(eq(schema.bookableModes.bookableId, bookableId))
    .orderBy(asc(schema.bookableModes.sortOrder))
  return rows.map(toBookableMode)
}

// ══ Availability rules ══
export async function listAvailabilityRules(bookableId: string): Promise<AvailabilityRule[]> {
  const rows = await db.select().from(schema.availabilityRules)
    .where(eq(schema.availabilityRules.bookableId, bookableId))
    .orderBy(asc(schema.availabilityRules.sortOrder))
  return rows.map(toAvailabilityRule)
}

// Every availability rule across a set of bookables (the scheduler loads a whole
// venue tree at once). Returns them keyed nowhere — the caller buckets by bookableId.
// `activeOnly` drops superseded/disabled rules (the sub-venue scheduler wants live ones).
export async function listAvailabilityRulesForBookables(bookableIds: string[], opts?: { activeOnly?: boolean }): Promise<AvailabilityRule[]> {
  if (!bookableIds.length) return []
  const where = opts?.activeOnly
    ? and(inArray(schema.availabilityRules.bookableId, bookableIds), eq(schema.availabilityRules.isActive, true))
    : inArray(schema.availabilityRules.bookableId, bookableIds)
  const rows = await db.select().from(schema.availabilityRules)
    .where(where)
    .orderBy(asc(schema.availabilityRules.sortOrder))
  return rows.map(toAvailabilityRule)
}

// The rules a booking editor supersedes (replaced_by_rule_id = ruleId) — auto-restored
// on delete. Small helper the granular availability routes use.
export async function listAvailabilityRulesReplacedBy(ruleId: string): Promise<AvailabilityRule[]> {
  const rows = await db.select().from(schema.availabilityRules)
    .where(eq(schema.availabilityRules.replacedByRuleId, ruleId))
  return rows.map(toAvailabilityRule)
}

function availabilitySet(patch: AvailabilityRulePatch): Record<string, any> {
  const s: Record<string, any> = {}
  const keys: (keyof AvailabilityRulePatch)[] = [
    'bookableId', 'name', 'ruleType', 'daysOfWeek', 'timeFrom', 'timeTo', 'eligibility',
    'membershipTypes', 'groupIds', 'sortOrder', 'isActive', 'capacityUsed', 'color', 'priceTiers',
    'timeSlots', 'weekInterval', 'weekAnchor', 'monthWeek', 'rrule', 'bookableModeId',
    'activityModeIds', 'maxConcurrent', 'validFrom', 'validUntil', 'replacedByRuleId',
    'inviteeModes', 'inviteeGroups',
  ]
  for (const k of keys) if (patch[k] !== undefined) s[k] = patch[k]
  return s
}

export async function createAvailabilityRule(input: AvailabilityRuleCreate): Promise<AvailabilityRule> {
  const id = randomUUID()
  await db.insert(schema.availabilityRules).values({
    id,
    name: '', ruleType: 'AVAILABLE', daysOfWeek: [], eligibility: {}, membershipTypes: [],
    groupIds: [], sortOrder: 0, isActive: true, capacityUsed: 0, color: '#1E2157',
    priceTiers: [], timeSlots: [], weekInterval: 1,
    ...availabilitySet(input),
  } as any)
  const [r] = await db.select().from(schema.availabilityRules).where(eq(schema.availabilityRules.id, id)).limit(1)
  return toAvailabilityRule(r)
}

export async function updateAvailabilityRule(id: string, patch: AvailabilityRulePatch): Promise<AvailabilityRule | null> {
  const s = availabilitySet(patch)
  if (Object.keys(s).length) await db.update(schema.availabilityRules).set(s).where(eq(schema.availabilityRules.id, id))
  const [r] = await db.select().from(schema.availabilityRules).where(eq(schema.availabilityRules.id, id)).limit(1)
  return r ? toAvailabilityRule(r) : null
}

export async function deleteAvailabilityRule(id: string): Promise<void> {
  await db.delete(schema.availabilityRules).where(eq(schema.availabilityRules.id, id))
}

// Replace every availability rule for a bookable (delete-then-insert). Used by the
// availability editor, which owns the whole set for a venue.
export async function replaceAvailabilityRules(bookableId: string, rules: AvailabilityRuleCreate[]): Promise<AvailabilityRule[]> {
  await db.delete(schema.availabilityRules).where(eq(schema.availabilityRules.bookableId, bookableId))
  for (const rule of rules) await createAvailabilityRule({ ...rule, bookableId })
  return listAvailabilityRules(bookableId)
}

// ══ Bookable configurations (+ children) ══
export async function listConfigurations(parentBookableId: string): Promise<BookableConfigurationFull[]> {
  const configs = await db.select().from(schema.bookableConfigurations)
    .where(eq(schema.bookableConfigurations.parentBookableId, parentBookableId))
    .orderBy(asc(schema.bookableConfigurations.sortOrder))
  if (!configs.length) return []
  const childRows = await db.select().from(schema.bookableConfigurationChildren)
    .where(inArray(schema.bookableConfigurationChildren.configurationId, configs.map((c) => c.id)))
    .orderBy(asc(schema.bookableConfigurationChildren.sortOrder))
  return configs.map((c) => ({
    id: c.id,
    parentBookableId: c.parentBookableId,
    key: c.key,
    name: c.name,
    sortOrder: c.sortOrder,
    children: childRows.filter((ch) => ch.configurationId === c.id).map((ch) => ({
      configurationId: ch.configurationId,
      bookableId: ch.bookableId,
      sortOrder: ch.sortOrder,
      slotIndex: ch.slotIndex,
      slotName: ch.slotName ?? null,
    })),
  }))
}

// Idempotent slot-aware save (the engine `useBookableConfigurations` used to run
// directly against Supabase). Re-applying the same `key` replaces the membership
// wholesale. `slots` = [{ name, childIds }]; empty slots are dropped — a save with no
// member ids is a no-op. Returns the configuration id (or null when nothing to save).
export async function saveConfiguration(
  parentBookableId: string,
  key: string,
  name: string,
  slots: { name: string; childIds: string[] }[],
): Promise<string | null> {
  const clean = slots.filter((s) => s.childIds.length > 0)
  if (!clean.length) return null
  const [existing] = await db.select({ id: schema.bookableConfigurations.id })
    .from(schema.bookableConfigurations)
    .where(and(
      eq(schema.bookableConfigurations.parentBookableId, parentBookableId),
      eq(schema.bookableConfigurations.key, key),
    )).limit(1)
  let configId = existing?.id
  if (configId) {
    await db.update(schema.bookableConfigurations).set({ name }).where(eq(schema.bookableConfigurations.id, configId))
    await db.delete(schema.bookableConfigurationChildren).where(eq(schema.bookableConfigurationChildren.configurationId, configId))
  } else {
    configId = randomUUID()
    await db.insert(schema.bookableConfigurations).values({
      id: configId, parentBookableId, key, name, sortOrder: 0,
    } as any)
  }
  const rows: any[] = []
  let sortOrder = 0
  for (let si = 0; si < clean.length; si++) {
    for (const bid of clean[si].childIds) {
      rows.push({ configurationId: configId, bookableId: bid, sortOrder: sortOrder++, slotIndex: si, slotName: clean[si].name })
    }
  }
  if (rows.length) await db.insert(schema.bookableConfigurationChildren).values(rows as any)
  return configId
}

export async function deleteConfiguration(configId: string): Promise<void> {
  await db.delete(schema.bookableConfigurationChildren).where(eq(schema.bookableConfigurationChildren.configurationId, configId))
  await db.delete(schema.bookableConfigurations).where(eq(schema.bookableConfigurations.id, configId))
}

// ══ Bookable ↔ door / light-zone links ══
export async function listBookableDoors(bookableId: string): Promise<string[]> {
  const rows = await db.select({ doorId: schema.bookableDoors.doorId }).from(schema.bookableDoors)
    .where(eq(schema.bookableDoors.bookableId, bookableId))
    .orderBy(asc(schema.bookableDoors.sortOrder))
  return rows.map((r) => r.doorId)
}
export async function listBookableLightZones(bookableId: string): Promise<string[]> {
  const rows = await db.select({ zoneId: schema.bookableLightZones.zoneId }).from(schema.bookableLightZones)
    .where(eq(schema.bookableLightZones.bookableId, bookableId))
    .orderBy(asc(schema.bookableLightZones.sortOrder))
  return rows.map((r) => r.zoneId)
}
export async function setBookableDoors(bookableId: string, doorIds: string[]): Promise<void> {
  await db.delete(schema.bookableDoors).where(eq(schema.bookableDoors.bookableId, bookableId))
  if (doorIds.length) await db.insert(schema.bookableDoors).values(doorIds.map((doorId, i) => ({ bookableId, doorId, sortOrder: i })) as any)
}
export async function setBookableLightZones(bookableId: string, zoneIds: string[]): Promise<void> {
  await db.delete(schema.bookableLightZones).where(eq(schema.bookableLightZones.bookableId, bookableId))
  if (zoneIds.length) await db.insert(schema.bookableLightZones).values(zoneIds.map((zoneId, i) => ({ bookableId, zoneId, sortOrder: i })) as any)
}

// ══ Doors ══
export async function listDoors(orgId: string): Promise<Door[]> {
  const rows = await db.select().from(schema.doors).where(eq(schema.doors.orgId, orgId)).orderBy(asc(schema.doors.name))
  return rows.map(toDoor)
}
export async function createDoor(input: DoorCreate): Promise<Door> {
  const id = randomUUID()
  await db.insert(schema.doors).values({ id, defaultUnlockSeconds: 5, isActive: true, ...cleanUndef(input) } as any)
  const [r] = await db.select().from(schema.doors).where(eq(schema.doors.id, id)).limit(1)
  return toDoor(r)
}
export async function updateDoor(id: string, patch: DoorPatch): Promise<Door | null> {
  const s = cleanUndef(patch)
  if (Object.keys(s).length) await db.update(schema.doors).set(s).where(eq(schema.doors.id, id))
  const [r] = await db.select().from(schema.doors).where(eq(schema.doors.id, id)).limit(1)
  return r ? toDoor(r) : null
}
export async function deleteDoor(id: string): Promise<void> {
  await db.delete(schema.doors).where(eq(schema.doors.id, id))
}

// ══ Light zones ══
export async function listLightZones(orgId: string): Promise<LightZone[]> {
  const rows = await db.select().from(schema.lightZones).where(eq(schema.lightZones.orgId, orgId)).orderBy(asc(schema.lightZones.name))
  return rows.map(toLightZone)
}
export async function createLightZone(input: LightZoneCreate): Promise<LightZone> {
  const id = randomUUID()
  await db.insert(schema.lightZones).values({ id, defaultLevelPercent: 100, isActive: true, ...cleanUndef(input) } as any)
  const [r] = await db.select().from(schema.lightZones).where(eq(schema.lightZones.id, id)).limit(1)
  return toLightZone(r)
}
export async function updateLightZone(id: string, patch: LightZonePatch): Promise<LightZone | null> {
  const s = cleanUndef(patch)
  if (Object.keys(s).length) await db.update(schema.lightZones).set(s).where(eq(schema.lightZones.id, id))
  const [r] = await db.select().from(schema.lightZones).where(eq(schema.lightZones.id, id)).limit(1)
  return r ? toLightZone(r) : null
}
export async function deleteLightZone(id: string): Promise<void> {
  await db.delete(schema.lightZones).where(eq(schema.lightZones.id, id))
}

/** Per-door / per-zone connected-venue counts for an org (the reverse of the per-bookable
 *  link reads). The join tables have no org_id, so scope by joining to the org's doors /
 *  light_zones. Feeds the Access catalogue's "N connected venues" badge. */
export async function accessConnectionCounts(orgId: string): Promise<{ doors: Record<string, number>; zones: Record<string, number> }> {
  const [doorRows, zoneRows] = await Promise.all([
    db.select({ doorId: schema.bookableDoors.doorId })
      .from(schema.bookableDoors)
      .innerJoin(schema.doors, eq(schema.doors.id, schema.bookableDoors.doorId))
      .where(eq(schema.doors.orgId, orgId)),
    db.select({ zoneId: schema.bookableLightZones.zoneId })
      .from(schema.bookableLightZones)
      .innerJoin(schema.lightZones, eq(schema.lightZones.id, schema.bookableLightZones.zoneId))
      .where(eq(schema.lightZones.orgId, orgId)),
  ])
  const doors: Record<string, number> = {}
  for (const r of doorRows) doors[r.doorId] = (doors[r.doorId] ?? 0) + 1
  const zones: Record<string, number> = {}
  for (const r of zoneRows) zones[r.zoneId] = (zones[r.zoneId] ?? 0) + 1
  return { doors, zones }
}

// Drop undefined keys from a patch (so a Drizzle .set() only touches provided cols).
function cleanUndef<T extends Record<string, any>>(o: T): Record<string, any> {
  const s: Record<string, any> = {}
  for (const k of Object.keys(o)) if (o[k] !== undefined) s[k] = o[k]
  return s
}

// ══ Activities ══
export async function listActivities(orgId: string): Promise<Activity[]> {
  const rows = await db.select().from(schema.activities)
    .where(eq(schema.activities.orgId, orgId))
    .orderBy(asc(schema.activities.sortOrder))
  return rows.map(toActivity)
}

export async function getActivity(id: string): Promise<Activity | null> {
  const [r] = await db.select().from(schema.activities).where(eq(schema.activities.id, id)).limit(1)
  return r ? toActivity(r) : null
}

// Every activity linked to a bookable (reverse of activity_bookables), plus any
// activity directly tagged with staff_bookable_id. Used by the staff "What I offer"
// tab to resolve/backfill a PERSON bookable's owning activity.
export async function listActivitiesForBookable(bookableId: string): Promise<Activity[]> {
  const linked = await db
    .select({ a: schema.activities })
    .from(schema.activityBookables)
    .innerJoin(schema.activities, eq(schema.activityBookables.activityId, schema.activities.id))
    .where(eq(schema.activityBookables.bookableId, bookableId))
  const tagged = await db.select().from(schema.activities).where(eq(schema.activities.staffBookableId, bookableId))
  const byId = new Map<string, typeof schema.activities.$inferSelect>()
  for (const r of linked) byId.set(r.a.id, r.a)
  for (const r of tagged) byId.set(r.id, r)
  return [...byId.values()].map(toActivity)
}

function activitySet(patch: ActivityPatch): Record<string, any> {
  const s: Record<string, any> = {}
  const keys: (keyof ActivityPatch)[] = [
    'orgId', 'name', 'description', 'color', 'icon', 'imageUrl', 'status', 'sortOrder',
    'requireMode', 'approvalMode', 'bookingWindowDays', 'minNoticeHours', 'cancellationWindowHours',
    'minDurationMins', 'maxDurationMins', 'bufferMins', 'areaNameSingular', 'areaNamePlural',
    'bookingsEnabled', 'allowMultiSlot', 'allowMultiSlotPeak', 'allowKiosk', 'allowRecurring',
    'allowMemberChanges', 'autoRemoveUnpaid', 'requireVisitorNames', 'hideMemberNames',
    'bookingFlow', 'modeLabel', 'modeDisplay', 'assignmentMode', 'staffBookableId',
  ]
  for (const k of keys) if (patch[k] !== undefined) s[k] = patch[k]
  return s
}

export async function createActivity(input: ActivityCreate): Promise<Activity> {
  const id = randomUUID()
  await db.insert(schema.activities).values({
    id,
    color: '#1E2157', icon: 'pi-calendar', status: 'ACTIVE', sortOrder: 0,
    requireMode: false, approvalMode: 'auto', bookingsEnabled: true,
    allowMultiSlot: false, allowMultiSlotPeak: false, allowKiosk: false, allowRecurring: false,
    allowMemberChanges: true, autoRemoveUnpaid: false, requireVisitorNames: false, hideMemberNames: false,
    bookingFlow: 'wizard', modeLabel: 'Mode', modeDisplay: 'cards', assignmentMode: 'system',
    ...activitySet(input),
  } as any)
  return (await getActivity(id))!
}

export async function updateActivity(id: string, patch: ActivityPatch): Promise<Activity | null> {
  const s = activitySet(patch)
  if (Object.keys(s).length) await db.update(schema.activities).set(s).where(eq(schema.activities.id, id))
  return getActivity(id)
}

export async function deleteActivity(id: string): Promise<void> {
  await db.delete(schema.activities).where(eq(schema.activities.id, id))
}

// ══ Activity modes ══
export async function listActivityModes(activityId: string): Promise<ActivityMode[]> {
  const rows = await db.select().from(schema.activityModes)
    .where(eq(schema.activityModes.activityId, activityId))
    .orderBy(asc(schema.activityModes.sortOrder))
  return rows.map(toActivityMode)
}

export async function getActivityMode(id: string): Promise<ActivityMode | null> {
  const [r] = await db.select().from(schema.activityModes).where(eq(schema.activityModes.id, id)).limit(1)
  return r ? toActivityMode(r) : null
}

function modeSet(patch: ActivityModePatch): Record<string, any> {
  const s: Record<string, any> = {}
  const keys: (keyof ActivityModePatch)[] = [
    'activityId', 'name', 'description', 'color', 'sortOrder', 'imageUrl', 'pricing', 'addons',
    'minPeople', 'maxPeople', 'minVisitors', 'maxVisitors', 'allowVisitors', 'formId',
    'defaultBookingView', 'paymentOptions', 'approvalMode', 'configurationKey', 'periodUnit',
    'periodCount', 'termType', 'periodPrice', 'category',
  ]
  for (const k of keys) if (patch[k] !== undefined) s[k] = patch[k]
  return s
}

export async function createActivityMode(input: ActivityModeCreate): Promise<ActivityMode> {
  const id = randomUUID()
  await db.insert(schema.activityModes).values({
    id,
    sortOrder: 0, pricing: {}, addons: [], paymentOptions: {}, allowVisitors: false,
    approvalMode: 'auto', periodCount: 1, termType: 'fixed',
    ...modeSet(input),
  } as any)
  return (await getActivityMode(id))!
}

export async function updateActivityMode(id: string, patch: ActivityModePatch): Promise<ActivityMode | null> {
  const s = modeSet(patch)
  if (Object.keys(s).length) await db.update(schema.activityModes).set(s).where(eq(schema.activityModes.id, id))
  return getActivityMode(id)
}

export async function deleteActivityMode(id: string): Promise<void> {
  await db.delete(schema.activityModes).where(eq(schema.activityModes.id, id))
}

// ══ Activity ↔ bookable / group / mode-scope join tables ══
export async function listActivityBookables(activityId: string): Promise<ActivityBookable[]> {
  const rows = await db.select().from(schema.activityBookables).where(eq(schema.activityBookables.activityId, activityId))
  return rows.map((r) => ({ id: r.id, activityId: r.activityId, bookableId: r.bookableId }))
}
export async function setActivityBookables(activityId: string, bookableIds: string[]): Promise<void> {
  await db.delete(schema.activityBookables).where(eq(schema.activityBookables.activityId, activityId))
  if (bookableIds.length) await db.insert(schema.activityBookables).values(bookableIds.map((bookableId) => ({ id: randomUUID(), activityId, bookableId })) as any)
}
export async function addActivityBookable(activityId: string, bookableId: string): Promise<void> {
  await db.insert(schema.activityBookables).values({ id: randomUUID(), activityId, bookableId } as any)
}
// APPEND (activity, bookable) links without touching the activity's existing ones —
// the create wizards link an existing activity to newly-made venues, so a
// delete-then-insert SET would wrongly unlink its other venues.
export async function addActivityBookables(activityId: string, bookableIds: string[]): Promise<void> {
  if (!bookableIds.length) return
  await db.insert(schema.activityBookables).values(bookableIds.map((bookableId) => ({ id: randomUUID(), activityId, bookableId })) as any)
}

export async function listActivityGroups(activityId: string): Promise<string[]> {
  const rows = await db.select({ groupId: schema.activityGroups.groupId }).from(schema.activityGroups)
    .where(eq(schema.activityGroups.activityId, activityId))
  return rows.map((r) => r.groupId)
}
export async function setActivityGroups(activityId: string, groupIds: string[]): Promise<void> {
  await db.delete(schema.activityGroups).where(eq(schema.activityGroups.activityId, activityId))
  if (groupIds.length) await db.insert(schema.activityGroups).values(groupIds.map((groupId) => ({ activityId, groupId })) as any)
}

export async function listActivityModeBookables(modeId: string): Promise<ActivityModeBookable[]> {
  const rows = await db.select().from(schema.activityModeBookables).where(eq(schema.activityModeBookables.modeId, modeId))
  return rows.map((r) => ({ modeId: r.modeId, bookableId: r.bookableId, priceOverride: r.priceOverride ?? null }))
}
export async function setActivityModeBookables(modeId: string, rows: ActivityModeBookable[]): Promise<void> {
  await db.delete(schema.activityModeBookables).where(eq(schema.activityModeBookables.modeId, modeId))
  if (rows.length) await db.insert(schema.activityModeBookables).values(rows.map((r) => ({ modeId, bookableId: r.bookableId, priceOverride: r.priceOverride ?? null })) as any)
}

export async function listActivityModeResources(modeId: string): Promise<ActivityModeResource[]> {
  const rows = await db.select().from(schema.activityModeResources)
    .where(eq(schema.activityModeResources.modeId, modeId))
    .orderBy(asc(schema.activityModeResources.sortOrder))
  return rows.map((r) => ({ modeId: r.modeId, bookableId: r.bookableId, sortOrder: r.sortOrder }))
}
export async function setActivityModeResources(modeId: string, bookableIds: string[]): Promise<void> {
  await db.delete(schema.activityModeResources).where(eq(schema.activityModeResources.modeId, modeId))
  if (bookableIds.length) await db.insert(schema.activityModeResources).values(bookableIds.map((bookableId, i) => ({ modeId, bookableId, sortOrder: i })) as any)
}

export async function listActivityModeRequiredItems(modeId: string): Promise<ActivityModeRequiredItem[]> {
  const rows = await db.select().from(schema.activityModeRequiredItems)
    .where(eq(schema.activityModeRequiredItems.modeId, modeId))
    .orderBy(asc(schema.activityModeRequiredItems.sortOrder))
  return rows.map((r) => ({
    id: r.id, modeId: r.modeId, bookableId: r.bookableId, quantity: r.quantity,
    sortOrder: r.sortOrder, isOptional: r.isOptional, priceOverride: r.priceOverride ?? null,
  }))
}
export async function setActivityModeRequiredItems(modeId: string, items: Omit<ActivityModeRequiredItem, 'id' | 'modeId'>[]): Promise<void> {
  await db.delete(schema.activityModeRequiredItems).where(eq(schema.activityModeRequiredItems.modeId, modeId))
  if (items.length) await db.insert(schema.activityModeRequiredItems).values(items.map((it, i) => ({
    id: randomUUID(), modeId, bookableId: it.bookableId, quantity: it.quantity ?? 1,
    sortOrder: it.sortOrder ?? i, isOptional: it.isOptional ?? false, priceOverride: it.priceOverride ?? null,
  })) as any)
}

// ══ Booking discounts (with scope join tables) ══
export async function listBookingDiscounts(orgId: string, opts?: { activeOnly?: boolean }): Promise<BookingDiscount[]> {
  const where = opts?.activeOnly
    ? and(eq(schema.bookingDiscounts.orgId, orgId), eq(schema.bookingDiscounts.isActive, true))
    : eq(schema.bookingDiscounts.orgId, orgId)
  const discs = await db.select().from(schema.bookingDiscounts).where(where).orderBy(desc(schema.bookingDiscounts.createdAt))
  if (!discs.length) return []
  const ids = discs.map((d) => d.id)
  const [acts, modes] = await Promise.all([
    db.select().from(schema.bookingDiscountActivities).where(inArray(schema.bookingDiscountActivities.discountId, ids)),
    db.select().from(schema.bookingDiscountActivityModes).where(inArray(schema.bookingDiscountActivityModes.discountId, ids)),
  ])
  const actMap: Record<string, string[]> = {}
  for (const r of acts) (actMap[r.discountId] ??= []).push(r.activityId)
  const modeMap: Record<string, string[]> = {}
  for (const r of modes) (modeMap[r.discountId] ??= []).push(r.activityModeId)
  return discs.map((d) => ({
    id: d.id, orgId: d.orgId, name: d.name, formText: d.formText ?? null,
    modifierType: d.modifierType, modifierValue: d.modifierValue, applyTo: d.applyTo,
    conditions: asArray(d.conditions), validFrom: toIsoN(d.validFrom), validUntil: toIsoN(d.validUntil),
    maxUses: d.maxUses ?? null, usesCount: d.usesCount, isActive: d.isActive,
    activityIds: actMap[d.id] ?? [], modeIds: modeMap[d.id] ?? [],
  }))
}

// Create/update a discount + its activity/mode scope in one call (delete-then-insert
// the join rows). Pass the full editable shape (minus id/usesCount).
export async function saveBookingDiscount(input: {
  id?: string
  orgId: string
  name: string
  formText?: string | null
  modifierType: string
  modifierValue: number | string
  applyTo: string
  conditions: any[]
  validFrom?: string | null
  validUntil?: string | null
  maxUses?: number | null
  isActive: boolean
  activityIds: string[]
  modeIds: string[]
}): Promise<BookingDiscount> {
  const id = input.id ?? randomUUID()
  const base = {
    orgId: input.orgId, name: input.name, formText: input.formText ?? null,
    modifierType: input.modifierType, modifierValue: input.modifierValue, applyTo: input.applyTo,
    conditions: input.conditions ?? [],
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validUntil: input.validUntil ? new Date(input.validUntil) : null,
    maxUses: input.maxUses ?? null, isActive: input.isActive,
  }
  if (input.id) {
    await db.update(schema.bookingDiscounts).set(base as any).where(eq(schema.bookingDiscounts.id, id))
  } else {
    await db.insert(schema.bookingDiscounts).values({ id, usesCount: 0, ...base } as any)
  }
  await db.delete(schema.bookingDiscountActivities).where(eq(schema.bookingDiscountActivities.discountId, id))
  await db.delete(schema.bookingDiscountActivityModes).where(eq(schema.bookingDiscountActivityModes.discountId, id))
  if (input.activityIds.length) await db.insert(schema.bookingDiscountActivities).values(input.activityIds.map((activityId) => ({ discountId: id, activityId })) as any)
  if (input.modeIds.length) await db.insert(schema.bookingDiscountActivityModes).values(input.modeIds.map((activityModeId) => ({ discountId: id, activityModeId })) as any)
  const [row] = await listBookingDiscounts(input.orgId).then((all) => all.filter((d) => d.id === id))
  return row
}

export async function deleteBookingDiscount(id: string): Promise<void> {
  await db.delete(schema.bookingDiscountActivities).where(eq(schema.bookingDiscountActivities.discountId, id))
  await db.delete(schema.bookingDiscountActivityModes).where(eq(schema.bookingDiscountActivityModes.discountId, id))
  await db.delete(schema.bookingDiscounts).where(eq(schema.bookingDiscounts.id, id))
}

// ══ Bookings ══
/**
 * Bookings for an org, newest first. There is no org_id on bookings, so scope via a
 * JOIN to the bookable (bookings.bookable_id → bookables.org_id) and carry that
 * org_id onto the domain object. Optional filters: bookableId(s), status, a
 * [from,to] window against start_at. `limit`/`offset` page the result.
 */
export async function listBookings(
  orgId: string,
  opts?: { limit?: number; offset?: number; bookableIds?: string[]; status?: string },
): Promise<Booking[]> {
  const conds: any[] = [eq(schema.bookables.orgId, orgId)]
  if (opts?.bookableIds?.length) conds.push(inArray(schema.bookings.bookableId, opts.bookableIds))
  if (opts?.status) conds.push(eq(schema.bookings.status, opts.status))
  let q = db
    .select({ b: schema.bookings, orgId: schema.bookables.orgId })
    .from(schema.bookings)
    .innerJoin(schema.bookables, eq(schema.bookings.bookableId, schema.bookables.id))
    .where(and(...conds))
    .orderBy(desc(schema.bookings.startAt))
    .$dynamic()
  if (opts?.limit != null) q = q.limit(opts.limit)
  if (opts?.offset != null) q = q.offset(opts.offset)
  const rows = await q
  return rows.map((r) => toBooking(r.b, r.orgId))
}

// Bookings for a set of bookables (a venue calendar loads one venue tree; a booker
// pre-flight loads the candidate units). Scoped by the bookable ids, which are
// themselves org-owned. Optional filters:
//   overlapStart/overlapEnd — TRUE interval overlap (start_at < overlapEnd AND
//     end_at > overlapStart): the clash/capacity pre-flight the wizard/scheduler/item
//     booker run before writing.
//   from/to — a window against start_at (the calendar's visible range).
//   excludeCancelled — drop CANCELLED rows (every overlap check wants this).
//   status — keep only this status.
// All ISO 8601 strings. Ordered by start_at ascending.
export async function listBookingsForBookables(
  bookableIds: string[],
  opts?: { overlapStart?: string; overlapEnd?: string; from?: string; to?: string; excludeCancelled?: boolean; status?: string },
): Promise<Booking[]> {
  if (!bookableIds.length) return []
  const conds: any[] = [inArray(schema.bookings.bookableId, bookableIds)]
  if (opts?.overlapStart != null) conds.push(gt(schema.bookings.endAt, new Date(opts.overlapStart)))
  if (opts?.overlapEnd != null) conds.push(lt(schema.bookings.startAt, new Date(opts.overlapEnd)))
  if (opts?.from != null) conds.push(gte(schema.bookings.startAt, new Date(opts.from)))
  if (opts?.to != null) conds.push(lte(schema.bookings.startAt, new Date(opts.to)))
  if (opts?.excludeCancelled) conds.push(ne(schema.bookings.status, 'CANCELLED'))
  if (opts?.status) conds.push(eq(schema.bookings.status, opts.status))
  const rows = await db
    .select({ b: schema.bookings, orgId: schema.bookables.orgId })
    .from(schema.bookings)
    .innerJoin(schema.bookables, eq(schema.bookings.bookableId, schema.bookables.id))
    .where(and(...conds))
    .orderBy(asc(schema.bookings.startAt))
  return rows.map((r) => toBooking(r.b, r.orgId))
}

// A booking's small display joins (bookable / activity / mode / event) folded in — for
// the pending queue + the venue edit dialog, which show more than the flat booking row.
function toBookingDetail(
  r: typeof schema.bookings.$inferSelect,
  orgId: string,
  joins: {
    bookableName: string | null; bookableLocation: string | null;
    activityName: string | null;
    modeId: string | null; modeName: string | null; modeColor: string | null;
    eventId: string | null; eventTitle: string | null;
  },
): BookingDetail {
  return {
    ...toBooking(r, orgId),
    bookable: joins.bookableName != null ? { id: r.bookableId, name: joins.bookableName, location: joins.bookableLocation ?? null } : null,
    activity: joins.activityName != null && r.activityId ? { id: r.activityId, name: joins.activityName } : null,
    activityMode: joins.modeId != null ? { id: joins.modeId, name: joins.modeName ?? '', color: joins.modeColor ?? null } : null,
    event: joins.eventId != null ? { id: joins.eventId, title: joins.eventTitle ?? '' } : null,
  }
}

const bookingDetailSelect = {
  b: schema.bookings,
  orgId: schema.bookables.orgId,
  bookableName: schema.bookables.name,
  bookableLocation: schema.bookables.location,
  activityName: schema.activities.name,
  modeId: schema.activityModes.id,
  modeName: schema.activityModes.name,
  modeColor: schema.activityModes.color,
  eventId: schema.events.id,
  eventTitle: schema.events.title,
}
function bookingDetailFrom() {
  return db
    .select(bookingDetailSelect)
    .from(schema.bookings)
    .innerJoin(schema.bookables, eq(schema.bookings.bookableId, schema.bookables.id))
    .leftJoin(schema.activities, eq(schema.bookings.activityId, schema.activities.id))
    .leftJoin(schema.activityModes, eq(schema.bookings.activityModeId, schema.activityModes.id))
    .leftJoin(schema.events, eq(schema.bookings.eventId, schema.events.id))
}
function mapDetailRow(r: any): BookingDetail {
  return toBookingDetail(r.b, r.orgId, {
    bookableName: r.bookableName, bookableLocation: r.bookableLocation,
    activityName: r.activityName, modeId: r.modeId, modeName: r.modeName, modeColor: r.modeColor,
    eventId: r.eventId, eventTitle: r.eventTitle,
  })
}

// An org's bookings WITH display joins, newest first. Same org scoping (join to the
// bookable) + the same optional filters as listBookings — used by the pending queue.
export async function listBookingsDetailed(
  orgId: string,
  opts?: { status?: string; bookableIds?: string[]; from?: string; to?: string },
): Promise<BookingDetail[]> {
  const conds: any[] = [eq(schema.bookables.orgId, orgId)]
  if (opts?.status) conds.push(eq(schema.bookings.status, opts.status))
  if (opts?.bookableIds?.length) conds.push(inArray(schema.bookings.bookableId, opts.bookableIds))
  if (opts?.from != null) conds.push(gte(schema.bookings.startAt, new Date(opts.from)))
  if (opts?.to != null) conds.push(lte(schema.bookings.startAt, new Date(opts.to)))
  const rows = await bookingDetailFrom().where(and(...conds)).orderBy(desc(schema.bookings.createdAt))
  return rows.map(mapDetailRow)
}

// One booking by id, WITH its display joins (the venue page's ?booking=<id> deep-link
// pops the edit dialog, which needs the mode/event/bookable names).
export async function getBookingDetailed(id: string): Promise<BookingDetail | null> {
  const [r] = await bookingDetailFrom().where(eq(schema.bookings.id, id)).limit(1)
  return r ? mapDetailRow(r) : null
}

// Bookings on a SET of bookables WITH display joins (the sub-venue scheduler renders the
// event title in each child column). Scoped by the bookable ids (org-owned), so no orgId
// is needed — which matters because the scheduler runs without an org context. Same
// optional window/overlap filters as the flat for-bookables read.
export async function listBookingsDetailedForBookables(
  bookableIds: string[],
  opts?: { overlapStart?: string; overlapEnd?: string; from?: string; to?: string; excludeCancelled?: boolean; status?: string },
): Promise<BookingDetail[]> {
  if (!bookableIds.length) return []
  const conds: any[] = [inArray(schema.bookings.bookableId, bookableIds)]
  if (opts?.overlapStart != null) conds.push(gt(schema.bookings.endAt, new Date(opts.overlapStart)))
  if (opts?.overlapEnd != null) conds.push(lt(schema.bookings.startAt, new Date(opts.overlapEnd)))
  if (opts?.from != null) conds.push(gte(schema.bookings.startAt, new Date(opts.from)))
  if (opts?.to != null) conds.push(lte(schema.bookings.startAt, new Date(opts.to)))
  if (opts?.excludeCancelled) conds.push(ne(schema.bookings.status, 'CANCELLED'))
  if (opts?.status) conds.push(eq(schema.bookings.status, opts.status))
  const rows = await bookingDetailFrom().where(and(...conds)).orderBy(asc(schema.bookings.startAt))
  return rows.map(mapDetailRow)
}

function bookingSet(input: Partial<BookingCreate>): Record<string, any> {
  const s: Record<string, any> = {}
  const keys: (keyof BookingCreate)[] = [
    'bookableId', 'eventId', 'sessionId', 'type', 'status', 'notes', 'contactName', 'contactEmail',
    'contactPhone', 'purpose', 'isAllDay', 'activityId', 'activityModeId', 'bookableModeId', 'modeId',
    'selectedAddons', 'attendeeCount', 'bookingDiscountId', 'discountAmount', 'customFields',
    'parentBookingId', 'isRecurring', 'subjectPersonId',
  ]
  for (const k of keys) if (input[k] !== undefined) s[k] = input[k]
  if (input.startAt !== undefined) s.startAt = new Date(input.startAt)
  if (input.endAt !== undefined) s.endAt = new Date(input.endAt)
  return s
}

// Insert one booking (the staff insert path). Returns the created booking with the
// org derived from its bookable.
export async function createBooking(input: BookingCreate): Promise<Booking> {
  const id = randomUUID()
  await db.insert(schema.bookings).values({
    id,
    type: 'BOOKING', status: 'CONFIRMED', isAllDay: false, selectedAddons: [], customFields: {},
    isRecurring: false,
    ...bookingSet(input),
  } as any)
  const [r] = await db
    .select({ b: schema.bookings, orgId: schema.bookables.orgId })
    .from(schema.bookings)
    .innerJoin(schema.bookables, eq(schema.bookings.bookableId, schema.bookables.id))
    .where(eq(schema.bookings.id, id)).limit(1)
  return toBooking(r.b, r.orgId)
}

// Insert many bookings (a multi-bookable slot reservation: one primary + N children
// sharing parent_booking_id). Returns them all.
export async function createBookings(inputs: BookingCreate[]): Promise<Booking[]> {
  const out: Booking[] = []
  for (const input of inputs) out.push(await createBooking(input))
  return out
}

export async function updateBookingStatus(id: string, status: string): Promise<void> {
  await db.update(schema.bookings).set({ status }).where(eq(schema.bookings.id, id))
}

// Full-field booking update (the calendar drag writes start/end; the venue edit dialog
// writes contacts/activity/mode/bookable/custom_fields/status). Only provided fields are
// touched. Returns the updated booking (with org derived from its bookable).
export async function updateBooking(id: string, patch: BookingPatch): Promise<Booking | null> {
  const s = bookingSet(patch)
  if (Object.keys(s).length) await db.update(schema.bookings).set(s).where(eq(schema.bookings.id, id))
  const [r] = await db
    .select({ b: schema.bookings, orgId: schema.bookables.orgId })
    .from(schema.bookings)
    .innerJoin(schema.bookables, eq(schema.bookings.bookableId, schema.bookables.id))
    .where(eq(schema.bookings.id, id)).limit(1)
  return r ? toBooking(r.b, r.orgId) : null
}

export async function deleteBooking(id: string): Promise<void> {
  await db.delete(schema.bookings).where(eq(schema.bookings.id, id))
}

/** Clear the EVENT_DRIVEN calendar bookings an event materialised on its linked venues,
 *  so a re-save doesn't duplicate them. Scoped to type='EVENT_DRIVEN' — never touches a
 *  real customer booking that happens to reference the event. */
export async function deleteEventDrivenBookings(eventId: string): Promise<void> {
  await db.delete(schema.bookings)
    .where(and(eq(schema.bookings.eventId, eventId), eq(schema.bookings.type, 'EVENT_DRIVEN')))
}

/** The EVENT_DRIVEN bookings an event has materialised on its venues (id + bookable +
 *  status), for the venue-sync diff (add missing, cancel removed). */
export async function eventDrivenBookings(eventId: string): Promise<{ id: string; bookableId: string; status: string }[]> {
  const rows = await db
    .select({ id: schema.bookings.id, bookableId: schema.bookings.bookableId, status: schema.bookings.status })
    .from(schema.bookings)
    .where(and(eq(schema.bookings.eventId, eventId), eq(schema.bookings.type, 'EVENT_DRIVEN')))
  return rows.map((r) => ({ id: r.id, bookableId: r.bookableId, status: r.status ?? '' }))
}

/** Re-time an event's active EVENT_DRIVEN venue bookings when the event's own time moves. */
export async function updateEventDrivenBookingTimes(
  eventId: string,
  times: { startAt: string; endAt: string; isAllDay: boolean },
): Promise<void> {
  await db.update(schema.bookings)
    .set({ startAt: times.startAt, endAt: times.endAt, isAllDay: times.isAllDay } as any)
    .where(and(
      eq(schema.bookings.eventId, eventId),
      eq(schema.bookings.type, 'EVENT_DRIVEN'),
      ne(schema.bookings.status, 'CANCELLED'),
    ))
}

// ══ Children-of-bookable read ══
// The direct children of a bookable (parent_id = id) — the calendar's mutual-exclusion
// tree walk, and the venue page's child/item lists. Returns full Bookable rows so the
// caller reuses the same shape it reads elsewhere. Ordered by sort_order.
export async function listBookableChildren(parentId: string): Promise<Bookable[]> {
  const rows = await db.select().from(schema.bookables)
    .where(eq(schema.bookables.parentId, parentId))
    .orderBy(asc(schema.bookables.sortOrder))
  return rows.map(toBookable)
}

// ══ Org-wide activity modes ══
// Every activity mode across an org's activities, in one query — replaces the N+1
// per-activity fan-out the venue edit dialog + availability editor used. Joins
// activity_modes → activities for the org filter; ordered by mode name.
export async function listActivityModesForOrg(orgId: string): Promise<ActivityMode[]> {
  const rows = await db
    .select({ m: schema.activityModes })
    .from(schema.activityModes)
    .innerJoin(schema.activities, eq(schema.activityModes.activityId, schema.activities.id))
    .where(eq(schema.activities.orgId, orgId))
    .orderBy(asc(schema.activityModes.name))
  return rows.map((r) => toActivityMode(r.m))
}

// ══ Booking windows (+ fixed slots) ══
function toBookingWindow(w: typeof schema.bookingWindows.$inferSelect, slots: (typeof schema.bookingWindowSlots.$inferSelect)[]): BookingWindow {
  return {
    id: w.id,
    bookableId: w.bookableId,
    name: w.name,
    windowType: w.windowType,
    daysOfWeek: asArray(w.daysOfWeek),
    startTime: String(w.startTime),
    endTime: String(w.endTime),
    slotDurationMins: w.slotDurationMins ?? null,
    bufferMins: w.bufferMins,
    capacity: w.capacity,
    sortOrder: w.sortOrder,
    isActive: w.isActive,
    slots: slots
      .filter((s) => s.windowId === w.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({
        id: s.id, windowId: s.windowId, slotStart: String(s.slotStart), slotEnd: String(s.slotEnd),
        capacity: s.capacity, label: s.label ?? null, sortOrder: s.sortOrder,
      })),
  }
}

export async function listBookingWindows(bookableId: string): Promise<BookingWindow[]> {
  const wins = await db.select().from(schema.bookingWindows)
    .where(eq(schema.bookingWindows.bookableId, bookableId))
    .orderBy(asc(schema.bookingWindows.sortOrder))
  if (!wins.length) return []
  const slots = await db.select().from(schema.bookingWindowSlots)
    .where(inArray(schema.bookingWindowSlots.windowId, wins.map((w) => w.id)))
  return wins.map((w) => toBookingWindow(w, slots))
}

function windowSet(patch: BookingWindowPatch): Record<string, any> {
  const s: Record<string, any> = {}
  const keys: (keyof BookingWindowPatch)[] = [
    'bookableId', 'name', 'windowType', 'daysOfWeek', 'startTime', 'endTime',
    'slotDurationMins', 'bufferMins', 'capacity', 'sortOrder', 'isActive',
  ]
  for (const k of keys) if (patch[k] !== undefined) s[k] = patch[k]
  return s
}

// Replace a window's fixed slots (delete-then-insert). Called on create-with-slots and
// on a patch that carries a slots array.
async function replaceWindowSlots(windowId: string, slots: BookingWindowSlotInput[]): Promise<void> {
  await db.delete(schema.bookingWindowSlots).where(eq(schema.bookingWindowSlots.windowId, windowId))
  if (slots.length) {
    await db.insert(schema.bookingWindowSlots).values(slots.map((s, i) => ({
      id: randomUUID(), windowId, slotStart: s.slotStart, slotEnd: s.slotEnd,
      capacity: s.capacity ?? 1, label: s.label ?? null, sortOrder: s.sortOrder ?? i,
    })) as any)
  }
}

export async function createBookingWindow(input: BookingWindowCreate): Promise<BookingWindow> {
  const id = randomUUID()
  const { slots, ...rest } = input
  await db.insert(schema.bookingWindows).values({
    id,
    name: '', windowType: 'OPEN', daysOfWeek: [], startTime: '09:00:00', endTime: '17:00:00',
    bufferMins: 0, capacity: 1, sortOrder: 0, isActive: true,
    ...windowSet(rest as BookingWindowPatch),
  } as any)
  if (slots) await replaceWindowSlots(id, slots)
  const [w] = await db.select().from(schema.bookingWindows).where(eq(schema.bookingWindows.id, id)).limit(1)
  const slotRows = await db.select().from(schema.bookingWindowSlots).where(eq(schema.bookingWindowSlots.windowId, id))
  return toBookingWindow(w, slotRows)
}

export async function updateBookingWindow(id: string, patch: BookingWindowPatch): Promise<BookingWindow | null> {
  const s = windowSet(patch)
  if (Object.keys(s).length) await db.update(schema.bookingWindows).set(s).where(eq(schema.bookingWindows.id, id))
  if (patch.slots !== undefined) await replaceWindowSlots(id, patch.slots)
  const [w] = await db.select().from(schema.bookingWindows).where(eq(schema.bookingWindows.id, id)).limit(1)
  if (!w) return null
  const slotRows = await db.select().from(schema.bookingWindowSlots).where(eq(schema.bookingWindowSlots.windowId, id))
  return toBookingWindow(w, slotRows)
}

export async function deleteBookingWindow(id: string): Promise<void> {
  await db.delete(schema.bookingWindowSlots).where(eq(schema.bookingWindowSlots.windowId, id))
  await db.delete(schema.bookingWindows).where(eq(schema.bookingWindows.id, id))
}

// ══ Bookable modes (write) ══
// Replace a bookable's whole mode set (the venue-editor Modes tab owns it —
// delete-then-insert). Empty-named rows are dropped by the caller before sending.
export async function setBookableModes(bookableId: string, modes: BookableModeInput[]): Promise<void> {
  await db.delete(schema.bookableModes).where(eq(schema.bookableModes.bookableId, bookableId))
  if (modes.length) {
    await db.insert(schema.bookableModes).values(modes.map((m, i) => ({
      id: randomUUID(), bookableId, name: m.name, description: m.description ?? null, color: m.color ?? null,
      minPlayers: m.minPlayers ?? null, maxPlayers: m.maxPlayers ?? null,
      pricePerHour: m.pricePerHour ?? null, pricePerSlot: m.pricePerSlot ?? null,
      flatFee: m.flatFee ?? null, pricePerPerson: m.pricePerPerson ?? null, sortOrder: i,
    })) as any)
  }
}

// ══ Activity ↔ bookable links, keyed BY bookable ══
// The venue editor's "linked activities" list is the by-bookable side of
// activity_bookables (the by-activity setter would clobber a bookable's OTHER links).
export async function listBookableActivityIds(bookableId: string): Promise<string[]> {
  const rows = await db.select({ activityId: schema.activityBookables.activityId }).from(schema.activityBookables)
    .where(eq(schema.activityBookables.bookableId, bookableId))
  return rows.map((r) => r.activityId)
}
export async function setBookableActivityIds(bookableId: string, activityIds: string[]): Promise<void> {
  await db.delete(schema.activityBookables).where(eq(schema.activityBookables.bookableId, bookableId))
  if (activityIds.length) await db.insert(schema.activityBookables).values(activityIds.map((activityId) => ({ id: randomUUID(), activityId, bookableId })) as any)
}

// ── Booking items (equipment bundled with a booking) ──
// The list rows for a set of item bookables (the wizard's Equipment section reads all
// items an org offers; this is the reserved-quantity side). booking_items itself has no
// time — the window comes from the parent bookings row, so we join and let the caller
// (or bookingItemUsage) resolve overlap.
export async function listBookingItemsForBookables(bookableIds: string[]): Promise<{ bookableId: string; quantity: number; bookingStartAt: string; bookingEndAt: string; bookingStatus: string }[]> {
  if (!bookableIds.length) return []
  const rows = await db
    .select({
      bookableId: schema.bookingItems.bookableId,
      quantity: schema.bookingItems.quantity,
      startAt: schema.bookings.startAt,
      endAt: schema.bookings.endAt,
      status: schema.bookings.status,
    })
    .from(schema.bookingItems)
    .innerJoin(schema.bookings, eq(schema.bookingItems.bookingId, schema.bookings.id))
    .where(inArray(schema.bookingItems.bookableId, bookableIds))
  return rows.map((r) => ({
    bookableId: r.bookableId,
    quantity: r.quantity ?? 0,
    bookingStartAt: toIso(r.startAt),
    bookingEndAt: toIso(r.endAt),
    bookingStatus: r.status,
  }))
}

// Summed item usage for the equipment-availability pre-flight: for each item bookable,
// how much is already reserved by non-cancelled bookings overlapping the proposed
// window (start_at < overlapEnd AND end_at > overlapStart). Returns a { bookableId ->
// used quantity } map; an id with no usage is simply absent (caller treats as 0).
export async function bookingItemUsage(
  bookableIds: string[],
  opts?: { overlapStart?: string; overlapEnd?: string },
): Promise<Record<string, number>> {
  if (!bookableIds.length) return {}
  const conds: any[] = [
    inArray(schema.bookingItems.bookableId, bookableIds),
    ne(schema.bookings.status, 'CANCELLED'),
  ]
  if (opts?.overlapEnd != null) conds.push(lt(schema.bookings.startAt, new Date(opts.overlapEnd)))
  if (opts?.overlapStart != null) conds.push(gt(schema.bookings.endAt, new Date(opts.overlapStart)))
  const rows = await db
    .select({ bookableId: schema.bookingItems.bookableId, quantity: schema.bookingItems.quantity })
    .from(schema.bookingItems)
    .innerJoin(schema.bookings, eq(schema.bookingItems.bookingId, schema.bookings.id))
    .where(and(...conds))
  const used: Record<string, number> = {}
  for (const r of rows) used[r.bookableId] = (used[r.bookableId] ?? 0) + (r.quantity ?? 0)
  return used
}

// Insert the equipment rows for a booking (one row per item type + quantity). sortOrder
// defaults to insert order when the caller omits it.
export async function createBookingItems(
  items: { bookingId: string; bookableId: string; quantity: number; sortOrder?: number }[],
): Promise<void> {
  if (!items.length) return
  await db.insert(schema.bookingItems).values(
    items.map((it, i) => ({
      id: randomUUID(),
      bookingId: it.bookingId,
      bookableId: it.bookableId,
      quantity: it.quantity,
      sortOrder: it.sortOrder ?? i,
    })) as any,
  )
}
