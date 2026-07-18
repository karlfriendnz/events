// The CONTRACT for the bookings domain: Zod schemas + the domain types inferred
// from them, shared by the client (typed composable) and the server (Nitro route
// output validation). DB-neutral by design — the array columns (sections, features,
// categories, sports) and the jsonb payloads (a mode's pricing/addons) are `json`
// in MySQL today, were Postgres arrays/jsonb before, and could be anything behind a
// future API; the UI only ever sees `string[]` / plain objects, and only the
// repository mapper knows the storage. Timestamps cross the wire as ISO 8601.
//
// Lives in shared/ so the Vue app and the Nitro server import the exact same
// definition — one source of truth for the shape AND its validation.
//
// The bookable/activity/mode schemas are WIDE — they expose the full column set the
// management screens (pages/bookables/[id].vue, BookableEditor, the activity + mode
// editors) read and write. Additive: consumers that only read a handful of fields
// (dashboard, groups) are unaffected. json columns cross the wire as real JS values.
import { z } from 'zod'

// MySQL decimals come back as strings; accept either so a numeric payload also passes.
const money = z.union([z.string(), z.number()]).nullable()
// A free json object / array — passthrough at the boundary.
const jsonObj = z.record(z.string(), z.any()).nullable()
const jsonArr = z.array(z.any())

// A bookable resource — a venue, court, item, or staff/person. `type` and `status`
// are open strings (validated as sets by the boundary, not a DB CHECK). The json
// array columns default to [] when unset.
export const bookableSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  internalName: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  parentId: z.string().nullable(),
  masterId: z.string().nullable(),
  isMaster: z.boolean(),
  isSlaveAutoAssign: z.boolean(),
  isPublic: z.boolean(),
  isNetwork: z.boolean(),
  maxConcurrent: z.number().int(),
  location: z.string().nullable(),
  showLocation: z.boolean(),
  description: z.string().nullable(),
  features: z.array(z.string()),
  rules: z.string().nullable(),
  images: jsonArr,
  categories: z.array(z.string()),
  sports: z.array(z.string()),
  customFields: jsonObj,
  sortOrder: z.number().int(),
  itemCategory: z.string().nullable(),
  defaultBookingView: z.string().nullable(),
  closedFrom: z.string().nullable(),
  closedUntil: z.string().nullable(),
  closureReason: z.string().nullable(),
  customizedSections: jsonArr,
  mainImage: z.string().nullable(),
  sponsorImage: z.string().nullable(),
  showInMenu: z.boolean(),
  sections: z.array(z.string()),
  spaceType: z.string().nullable(),
  bookingLimitType: z.string(),
  bookingLimitCount: z.number().int().nullable(),
  disallowConcurrent: z.boolean(),
  disallowConsecutive: z.boolean(),
  allowModesWithOthers: z.boolean(),
  allowSubVenues: z.boolean(),
  autoResolveChildren: z.boolean(),
  accessEnabled: z.boolean(),
  accessCodeDelivery: z.string(),
  accessCodeLength: z.number().int(),
  accessUnlockBeforeMins: z.number().int(),
  accessUnlockAfterMins: z.number().int(),
  lightingRampUpMins: z.number().int(),
  lightingRampDownMins: z.number().int(),
  lightingLevelPercent: z.number().int(),
})
export type Bookable = z.infer<typeof bookableSchema>

export const bookableListSchema = z.array(bookableSchema)

// WRITE contracts. Create omits the server-owned id (the repo generates it) and
// makes everything but orgId + name optional — the repo/DB supply the rest. Update
// is a partial.
export const bookableCreateSchema = bookableSchema
  .omit({ id: true })
  .partial()
  .required({ orgId: true })
  .extend({ name: z.string().min(1) })
export type BookableCreate = z.infer<typeof bookableCreateSchema>

export const bookablePatchSchema = bookableSchema.omit({ id: true }).partial()
export type BookablePatch = z.infer<typeof bookablePatchSchema>

// An activity — the bookable "thing to do" (a court hire, a coaching service, an
// item rental). `bookingFlow` (wizard|scheduler|item) + `assignmentMode` are open
// strings. `staffBookableId` non-null = owned by one staff/PERSON bookable.
export const activitySchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string(),
  imageUrl: z.string().nullable(),
  status: z.string(),
  sortOrder: z.number().int(),
  requireMode: z.boolean(),
  approvalMode: z.string(),
  bookingWindowDays: z.number().int().nullable(),
  minNoticeHours: z.number().int().nullable(),
  cancellationWindowHours: z.number().int().nullable(),
  minDurationMins: z.number().int().nullable(),
  maxDurationMins: z.number().int().nullable(),
  bufferMins: z.number().int().nullable(),
  areaNameSingular: z.string().nullable(),
  areaNamePlural: z.string().nullable(),
  bookingsEnabled: z.boolean(),
  allowMultiSlot: z.boolean(),
  allowMultiSlotPeak: z.boolean(),
  allowKiosk: z.boolean(),
  allowRecurring: z.boolean(),
  allowMemberChanges: z.boolean(),
  autoRemoveUnpaid: z.boolean(),
  requireVisitorNames: z.boolean(),
  hideMemberNames: z.boolean(),
  bookingFlow: z.string(),
  modeLabel: z.string(),
  modeDisplay: z.string(),
  assignmentMode: z.string(),
  staffBookableId: z.string().nullable(),
})
export type Activity = z.infer<typeof activitySchema>

export const activityListSchema = z.array(activitySchema)

export const activityCreateSchema = activitySchema
  .omit({ id: true })
  .partial()
  .required({ orgId: true })
  .extend({ name: z.string().min(1) })
export type ActivityCreate = z.infer<typeof activityCreateSchema>

export const activityPatchSchema = activitySchema.omit({ id: true }).partial()
export type ActivityPatch = z.infer<typeof activityPatchSchema>

// A mode of an activity (e.g. "Singles", "Doubles", a rate card). `pricing` is a
// free jsonb object, `addons`/`paymentOptions` jsonb — passthrough at the boundary.
// Item modes carry period_* + term_type + period_price (decimal → string|number|null).
export const activityModeSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  imageUrl: z.string().nullable(),
  pricing: jsonObj,
  addons: jsonArr,
  minPeople: z.number().int().nullable(),
  maxPeople: z.number().int().nullable(),
  minVisitors: z.number().int().nullable(),
  maxVisitors: z.number().int().nullable(),
  allowVisitors: z.boolean(),
  formId: z.string().nullable(),
  defaultBookingView: z.string().nullable(),
  paymentOptions: jsonObj,
  approvalMode: z.string(),
  configurationKey: z.string().nullable(),
  periodUnit: z.string().nullable(),
  periodCount: z.number().int(),
  termType: z.string(),
  periodPrice: money,
  category: z.string().nullable(),
})
export type ActivityMode = z.infer<typeof activityModeSchema>

export const activityModeListSchema = z.array(activityModeSchema)

export const activityModeCreateSchema = activityModeSchema
  .omit({ id: true })
  .partial()
  .required({ activityId: true })
  .extend({ name: z.string().min(1) })
export type ActivityModeCreate = z.infer<typeof activityModeCreateSchema>

export const activityModePatchSchema = activityModeSchema.omit({ id: true }).partial()
export type ActivityModePatch = z.infer<typeof activityModePatchSchema>

// A bookable's own booking mode (bookable_modes — e.g. "Singles" on a court). Prices
// are decimals → string|number|null.
export const bookableModeSchema = z.object({
  id: z.string(),
  bookableId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  minPlayers: z.number().int().nullable(),
  maxPlayers: z.number().int().nullable(),
  sortOrder: z.number().int(),
  pricePerHour: money,
  pricePerSlot: money,
  flatFee: money,
  pricePerPerson: money,
})
export type BookableMode = z.infer<typeof bookableModeSchema>
export const bookableModeListSchema = z.array(bookableModeSchema)

// An availability rule for a bookable — the days/time window and slot config the
// calendar/scheduler iterates. Many json columns; times are HH:MM:SS strings.
export const availabilityRuleSchema = z.object({
  id: z.string(),
  bookableId: z.string(),
  name: z.string(),
  ruleType: z.string(),
  daysOfWeek: jsonArr,
  timeFrom: z.string().nullable(),
  timeTo: z.string().nullable(),
  eligibility: jsonObj,
  membershipTypes: jsonArr,
  groupIds: jsonArr,
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  capacityUsed: z.number().int(),
  color: z.string(),
  priceTiers: jsonArr,
  timeSlots: jsonArr,
  weekInterval: z.number().int(),
  weekAnchor: z.string().nullable(),
  monthWeek: z.number().int().nullable(),
  rrule: z.string().nullable(),
  bookableModeId: z.string().nullable(),
  activityModeIds: jsonArr.nullable(),
  maxConcurrent: z.number().int().nullable(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  replacedByRuleId: z.string().nullable(),
  inviteeModes: jsonArr.nullable(),
  inviteeGroups: jsonArr.nullable(),
})
export type AvailabilityRule = z.infer<typeof availabilityRuleSchema>
export const availabilityRuleListSchema = z.array(availabilityRuleSchema)

export const availabilityRuleCreateSchema = availabilityRuleSchema
  .omit({ id: true })
  .partial()
  .required({ bookableId: true })
export type AvailabilityRuleCreate = z.infer<typeof availabilityRuleCreateSchema>
export const availabilityRulePatchSchema = availabilityRuleSchema.omit({ id: true }).partial()
export type AvailabilityRulePatch = z.infer<typeof availabilityRulePatchSchema>

// A named configuration over a parent venue's sub-venues + its slot children.
export const bookableConfigurationSchema = z.object({
  id: z.string(),
  parentBookableId: z.string(),
  key: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
})
export type BookableConfiguration = z.infer<typeof bookableConfigurationSchema>

export const bookableConfigurationChildSchema = z.object({
  configurationId: z.string(),
  bookableId: z.string(),
  sortOrder: z.number().int(),
  slotIndex: z.number().int(),
  slotName: z.string().nullable(),
})
export type BookableConfigurationChild = z.infer<typeof bookableConfigurationChildSchema>

// A configuration with its children folded in (what the sub-venues panel reads).
export const bookableConfigurationFullSchema = bookableConfigurationSchema.extend({
  children: z.array(bookableConfigurationChildSchema),
})
export type BookableConfigurationFull = z.infer<typeof bookableConfigurationFullSchema>
export const bookableConfigurationFullListSchema = z.array(bookableConfigurationFullSchema)

// A door / light zone in the org-wide access catalogue.
export const doorSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  locationNote: z.string().nullable(),
  hardwareProvider: z.string().nullable(),
  hardwareId: z.string().nullable(),
  defaultUnlockSeconds: z.number().int(),
  isActive: z.boolean(),
})
export type Door = z.infer<typeof doorSchema>
export const doorListSchema = z.array(doorSchema)
export const doorCreateSchema = doorSchema.omit({ id: true }).partial().required({ orgId: true }).extend({ name: z.string().min(1) })
export type DoorCreate = z.infer<typeof doorCreateSchema>
export const doorPatchSchema = doorSchema.omit({ id: true }).partial()
export type DoorPatch = z.infer<typeof doorPatchSchema>

export const lightZoneSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  hardwareProvider: z.string().nullable(),
  hardwareId: z.string().nullable(),
  defaultLevelPercent: z.number().int(),
  isActive: z.boolean(),
})
export type LightZone = z.infer<typeof lightZoneSchema>
export const lightZoneListSchema = z.array(lightZoneSchema)
export const lightZoneCreateSchema = lightZoneSchema.omit({ id: true }).partial().required({ orgId: true }).extend({ name: z.string().min(1) })
export type LightZoneCreate = z.infer<typeof lightZoneCreateSchema>
export const lightZonePatchSchema = lightZoneSchema.omit({ id: true }).partial()
export type LightZonePatch = z.infer<typeof lightZonePatchSchema>

// An org's booking discount (with its activity/mode scope folded in as id arrays).
export const bookingDiscountSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  formText: z.string().nullable(),
  modifierType: z.string(),
  modifierValue: z.union([z.string(), z.number()]),
  applyTo: z.string(),
  conditions: jsonArr,
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  maxUses: z.number().int().nullable(),
  usesCount: z.number().int(),
  isActive: z.boolean(),
  activityIds: z.array(z.string()),
  modeIds: z.array(z.string()),
})
export type BookingDiscount = z.infer<typeof bookingDiscountSchema>
export const bookingDiscountListSchema = z.array(bookingDiscountSchema)

// A mode's linked bookables / resources / required items, and a booking's bundled
// items — small join-row shapes the mode + booking editors read/write.
export const activityModeBookableSchema = z.object({
  modeId: z.string(),
  bookableId: z.string(),
  priceOverride: money,
})
export type ActivityModeBookable = z.infer<typeof activityModeBookableSchema>

export const activityModeResourceSchema = z.object({
  modeId: z.string(),
  bookableId: z.string(),
  sortOrder: z.number().int(),
})
export type ActivityModeResource = z.infer<typeof activityModeResourceSchema>

export const activityModeRequiredItemSchema = z.object({
  id: z.string(),
  modeId: z.string(),
  bookableId: z.string(),
  quantity: z.number().int(),
  sortOrder: z.number().int(),
  isOptional: z.boolean(),
  priceOverride: money,
})
export type ActivityModeRequiredItem = z.infer<typeof activityModeRequiredItemSchema>

export const activityBookableSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  bookableId: z.string(),
})
export type ActivityBookable = z.infer<typeof activityBookableSchema>

// A booking of a bookable. NB there is no org_id column on bookings — the repository
// derives orgId by joining the bookable, so the domain object stays org-scoped like
// everything else. Timestamps (startAt/endAt) cross the wire as ISO 8601. contactName
// feeds the dashboard activity cards.
export const bookingSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  bookableId: z.string(),
  eventId: z.string().nullable(),
  sessionId: z.string().nullable(),
  type: z.string(),
  status: z.string(),
  startAt: z.string(),
  endAt: z.string(),
  notes: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  purpose: z.string().nullable(),
  isAllDay: z.boolean(),
  activityId: z.string().nullable(),
  activityModeId: z.string().nullable(),
  bookableModeId: z.string().nullable(),
  modeId: z.string().nullable(),
  selectedAddons: jsonArr,
  attendeeCount: z.number().int().nullable(),
  bookingDiscountId: z.string().nullable(),
  discountAmount: money,
  customFields: jsonObj,
  parentBookingId: z.string().nullable(),
  isRecurring: z.boolean(),
  subjectPersonId: z.string().nullable(),
  accessCode: z.string().nullable(),
})
export type Booking = z.infer<typeof bookingSchema>

export const bookingListSchema = z.array(bookingSchema)

// WRITE contract for a booking (staff insert path). id is server-owned; the repo/DB
// supply the many defaults. bookableId + startAt + endAt are required.
export const bookingCreateSchema = bookingSchema
  .omit({ id: true, orgId: true })
  .partial()
  .required({ bookableId: true, startAt: true, endAt: true })
export type BookingCreate = z.infer<typeof bookingCreateSchema>
