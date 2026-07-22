// GENERATED first-pass MySQL schema (scripts/generate-mysql-schema.ts) from the live
// Postgres inventory. 118 tables. Porting rules per
// docs/replumb-architecture.md: uuid->varchar(36), text[]/uuid[]/int[]->json,
// jsonb->json, int4->int, numeric->decimal(12,2), bool->boolean, timestamptz->timestamp.
//
// FIRST PASS — deferred to per-domain refinement: FK constraints, secondary/unique
// indexes, non-now() column defaults (handled in repositories), decimal precision,
// and arrays that should be join tables. Hand-edit tables here as their domain is
// migrated; re-running the generator OVERWRITES, so refine by hand from here on.
import { mysqlTable, boolean, date, decimal, int, json, primaryKey, smallint, text, time, timestamp, varchar } from 'drizzle-orm/mysql-core'

export const accessScans = mysqlTable('access_scans', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }),
  bookableId: varchar('bookable_id', { length: 36 }),
  personId: varchar('person_id', { length: 36 }),
  credential: text('credential').notNull(),
  door: text('door'),
  scannedAt: timestamp('scanned_at').notNull().defaultNow(),
  result: text('result').notNull(),
  reason: text('reason'),
  doorId: varchar('door_id', { length: 36 }),
  bookingId: varchar('booking_id', { length: 36 }),
})

export const activities = mysqlTable('activities', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  status: text('status').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  requireMode: boolean('require_mode').notNull(),
  approvalMode: text('approval_mode').notNull(),
  bookingWindowDays: int('booking_window_days'),
  minNoticeHours: int('min_notice_hours'),
  cancellationWindowHours: int('cancellation_window_hours'),
  minDurationMins: int('min_duration_mins'),
  maxDurationMins: int('max_duration_mins'),
  bufferMins: int('buffer_mins'),
  areaNameSingular: text('area_name_singular'),
  areaNamePlural: text('area_name_plural'),
  bookingsEnabled: boolean('bookings_enabled').notNull(),
  allowMultiSlot: boolean('allow_multi_slot').notNull(),
  allowMultiSlotPeak: boolean('allow_multi_slot_peak').notNull(),
  allowKiosk: boolean('allow_kiosk').notNull(),
  allowRecurring: boolean('allow_recurring').notNull(),
  allowMemberChanges: boolean('allow_member_changes').notNull(),
  autoRemoveUnpaid: boolean('auto_remove_unpaid').notNull(),
  requireVisitorNames: boolean('require_visitor_names').notNull(),
  hideMemberNames: boolean('hide_member_names').notNull(),
  imageUrl: text('image_url'),
  bookingFlow: text('booking_flow').notNull(),
  modeLabel: text('mode_label').notNull(),
  modeDisplay: text('mode_display').notNull(),
  assignmentMode: text('assignment_mode').notNull(),
  staffBookableId: varchar('staff_bookable_id', { length: 36 }),
})

export const activityBookables = mysqlTable('activity_bookables', {
  id: varchar('id', { length: 36 }).primaryKey(),
  activityId: varchar('activity_id', { length: 36 }).notNull(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
})

export const activityGroups = mysqlTable('activity_groups', {
  activityId: varchar('activity_id', { length: 36 }).notNull(),
  groupId: varchar('group_id', { length: 36 }).notNull(),
}, (t) => [primaryKey({ columns: [t.activityId, t.groupId] })])

export const activityModeBookables = mysqlTable('activity_mode_bookables', {
  modeId: varchar('mode_id', { length: 36 }).notNull(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  priceOverride: decimal('price_override', { precision: 12, scale: 2 }),
}, (t) => [primaryKey({ columns: [t.modeId, t.bookableId] })])

export const activityModeRequiredItems = mysqlTable('activity_mode_required_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  modeId: varchar('mode_id', { length: 36 }).notNull(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  quantity: int('quantity').notNull(),
  sortOrder: int('sort_order').notNull(),
  isOptional: boolean('is_optional').notNull(),
  priceOverride: decimal('price_override', { precision: 12, scale: 2 }),
})

export const activityModeResources = mysqlTable('activity_mode_resources', {
  modeId: varchar('mode_id', { length: 36 }).notNull(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order').notNull(),
}, (t) => [primaryKey({ columns: [t.modeId, t.bookableId] })])

export const activityModes = mysqlTable('activity_modes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  activityId: varchar('activity_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  imageUrl: text('image_url'),
  pricing: json('pricing').notNull(),
  addons: json('addons').notNull(),
  minPeople: int('min_people'),
  maxPeople: int('max_people'),
  minVisitors: int('min_visitors'),
  maxVisitors: int('max_visitors'),
  allowVisitors: boolean('allow_visitors').notNull(),
  formId: varchar('form_id', { length: 36 }),
  defaultBookingView: text('default_booking_view'),
  paymentOptions: json('payment_options').notNull(),
  approvalMode: text('approval_mode').notNull(),
  configurationKey: text('configuration_key'),
  periodUnit: text('period_unit'),
  periodCount: int('period_count').notNull(),
  termType: text('term_type').notNull(),
  periodPrice: decimal('period_price', { precision: 12, scale: 2 }),
  category: text('category'),
})

export const addons = mysqlTable('addons', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  sessionId: varchar('session_id', { length: 36 }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  xeroCode: text('xero_code'),
  stockLimit: int('stock_limit'),
  refundPolicy: text('refund_policy'),
  visibilityRule: json('visibility_rule'),
  options: json('options'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const attendance = mysqlTable('attendance', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  sessionId: varchar('session_id', { length: 36 }),
  personId: varchar('person_id', { length: 36 }).notNull(),
  attended: boolean('attended').notNull(),
  markedAt: timestamp('marked_at'),
  markedBy: text('marked_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const auditLog = mysqlTable('audit_log', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }),
  entityType: text('entity_type').notNull(),
  entityId: varchar('entity_id', { length: 36 }).notNull(),
  action: text('action').notNull(),
  actorId: varchar('actor_id', { length: 36 }),
  beforeData: json('before_data'),
  afterData: json('after_data'),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const availabilityRules = mysqlTable('availability_rules', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  ruleType: text('rule_type').notNull(),
  daysOfWeek: json('days_of_week').notNull(),
  timeFrom: time('time_from'),
  timeTo: time('time_to'),
  eligibility: json('eligibility').notNull(),
  membershipTypes: json('membership_types').notNull(),
  groupIds: json('group_ids').notNull(),
  sortOrder: int('sort_order').notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  capacityUsed: int('capacity_used').notNull(),
  color: text('color').notNull(),
  priceTiers: json('price_tiers').notNull(),
  timeSlots: json('time_slots').notNull(),
  weekInterval: smallint('week_interval').notNull(),
  weekAnchor: date('week_anchor'),
  monthWeek: smallint('month_week'),
  rrule: text('rrule'),
  bookableModeId: varchar('bookable_mode_id', { length: 36 }),
  activityModeIds: json('activity_mode_ids'),
  maxConcurrent: smallint('max_concurrent'),
  validFrom: date('valid_from'),
  validUntil: date('valid_until'),
  replacedByRuleId: varchar('replaced_by_rule_id', { length: 36 }),
  inviteeModes: json('invitee_modes'),
  inviteeGroups: json('invitee_groups'),
})

export const bankAccounts = mysqlTable('bank_accounts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  details: text('details'),
  isDefault: boolean('is_default').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const bookableClosures = mysqlTable('bookable_closures', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  isRecurring: boolean('is_recurring').notNull(),
  recurrenceRule: text('recurrence_rule'),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const bookableConfigurationChildren = mysqlTable('bookable_configuration_children', {
  configurationId: varchar('configuration_id', { length: 36 }).notNull(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order').notNull(),
  slotIndex: int('slot_index').notNull(),
  slotName: text('slot_name'),
}, (t) => [primaryKey({ columns: [t.configurationId, t.bookableId] })])

export const bookableConfigurations = mysqlTable('bookable_configurations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  parentBookableId: varchar('parent_bookable_id', { length: 36 }).notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const bookableDoors = mysqlTable('bookable_doors', {
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  doorId: varchar('door_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order').notNull(),
}, (t) => [primaryKey({ columns: [t.bookableId, t.doorId] })])

export const bookableLightZones = mysqlTable('bookable_light_zones', {
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  zoneId: varchar('zone_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order').notNull(),
}, (t) => [primaryKey({ columns: [t.bookableId, t.zoneId] })])

export const bookableModes = mysqlTable('bookable_modes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  minPlayers: int('min_players'),
  maxPlayers: int('max_players'),
  sortOrder: int('sort_order').notNull(),
  pricePerHour: decimal('price_per_hour', { precision: 12, scale: 2 }),
  pricePerSlot: decimal('price_per_slot', { precision: 12, scale: 2 }),
  flatFee: decimal('flat_fee', { precision: 12, scale: 2 }),
  pricePerPerson: decimal('price_per_person', { precision: 12, scale: 2 }),
})

export const bookables = mysqlTable('bookables', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  internalName: text('internal_name'),
  type: text('type').notNull(),
  status: text('status').notNull(),
  parentId: varchar('parent_id', { length: 36 }),
  masterId: varchar('master_id', { length: 36 }),
  isSlaveAutoAssign: boolean('is_slave_auto_assign').notNull(),
  isPublic: boolean('is_public').notNull(),
  isNetwork: boolean('is_network').notNull(),
  maxConcurrent: int('max_concurrent').notNull(),
  location: text('location'),
  showLocation: boolean('show_location').notNull(),
  description: text('description'),
  features: json('features'),
  rules: text('rules'),
  images: json('images'),
  categories: json('categories'),
  sports: json('sports'),
  customFields: json('custom_fields'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  itemCategory: text('item_category'),
  defaultBookingView: text('default_booking_view'),
  closedFrom: date('closed_from'),
  closedUntil: date('closed_until'),
  closureReason: text('closure_reason'),
  isMaster: boolean('is_master').notNull(),
  customizedSections: json('customized_sections').notNull(),
  mainImage: text('main_image'),
  sponsorImage: text('sponsor_image'),
  showInMenu: boolean('show_in_menu').notNull(),
  sections: json('sections'),
  spaceType: text('space_type'),
  bookingLimitType: text('booking_limit_type').notNull(),
  bookingLimitCount: int('booking_limit_count'),
  disallowConcurrent: boolean('disallow_concurrent').notNull(),
  disallowConsecutive: boolean('disallow_consecutive').notNull(),
  allowModesWithOthers: boolean('allow_modes_with_others').notNull(),
  allowSubVenues: boolean('allow_sub_venues').notNull(),
  autoResolveChildren: boolean('auto_resolve_children').notNull(),
  accessEnabled: boolean('access_enabled').notNull(),
  accessCodeDelivery: text('access_code_delivery').notNull(),
  accessCodeLength: int('access_code_length').notNull(),
  accessUnlockBeforeMins: int('access_unlock_before_mins').notNull(),
  accessUnlockAfterMins: int('access_unlock_after_mins').notNull(),
  lightingRampUpMins: int('lighting_ramp_up_mins').notNull(),
  lightingRampDownMins: int('lighting_ramp_down_mins').notNull(),
  lightingLevelPercent: int('lighting_level_percent').notNull(),
})

export const bookingDiscountActivities = mysqlTable('booking_discount_activities', {
  discountId: varchar('discount_id', { length: 36 }).notNull(),
  activityId: varchar('activity_id', { length: 36 }).notNull(),
}, (t) => [primaryKey({ columns: [t.discountId, t.activityId] })])

export const bookingDiscountActivityModes = mysqlTable('booking_discount_activity_modes', {
  discountId: varchar('discount_id', { length: 36 }).notNull(),
  activityModeId: varchar('activity_mode_id', { length: 36 }).notNull(),
}, (t) => [primaryKey({ columns: [t.discountId, t.activityModeId] })])

export const bookingDiscounts = mysqlTable('booking_discounts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  formText: text('form_text'),
  modifierType: text('modifier_type').notNull(),
  modifierValue: decimal('modifier_value', { precision: 12, scale: 2 }).notNull(),
  applyTo: text('apply_to').notNull(),
  conditions: json('conditions').notNull(),
  validFrom: timestamp('valid_from'),
  validUntil: timestamp('valid_until'),
  maxUses: int('max_uses'),
  usesCount: int('uses_count').notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const bookingItems = mysqlTable('booking_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bookingId: varchar('booking_id', { length: 36 }).notNull(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  quantity: int('quantity').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const bookingWindowSlots = mysqlTable('booking_window_slots', {
  id: varchar('id', { length: 36 }).primaryKey(),
  windowId: varchar('window_id', { length: 36 }).notNull(),
  slotStart: time('slot_start').notNull(),
  slotEnd: time('slot_end').notNull(),
  capacity: int('capacity').notNull(),
  label: text('label'),
  sortOrder: int('sort_order').notNull(),
})

export const bookingWindows = mysqlTable('booking_windows', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  windowType: text('window_type').notNull(),
  daysOfWeek: json('days_of_week').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  slotDurationMins: int('slot_duration_mins'),
  bufferMins: int('buffer_mins').notNull(),
  capacity: int('capacity').notNull(),
  sortOrder: int('sort_order').notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const bookings = mysqlTable('bookings', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bookableId: varchar('bookable_id', { length: 36 }).notNull(),
  eventId: varchar('event_id', { length: 36 }),
  sessionId: varchar('session_id', { length: 36 }),
  type: text('type').notNull(),
  status: text('status').notNull(),
  startAt: timestamp('start_at').notNull(),
  endAt: timestamp('end_at').notNull(),
  recurrenceRule: text('recurrence_rule'),
  notes: text('notes'),
  overrideReason: text('override_reason'),
  createdBy: varchar('created_by', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  purpose: text('purpose'),
  isAllDay: boolean('is_all_day').notNull(),
  modeId: varchar('mode_id', { length: 36 }),
  activityId: varchar('activity_id', { length: 36 }),
  activityModeId: varchar('activity_mode_id', { length: 36 }),
  bookableModeId: varchar('bookable_mode_id', { length: 36 }),
  selectedAddons: json('selected_addons').notNull(),
  attendeeCount: int('attendee_count'),
  bookingDiscountId: varchar('booking_discount_id', { length: 36 }),
  discountAmount: decimal('discount_amount', { precision: 12, scale: 2 }),
  customFields: json('custom_fields').notNull(),
  parentBookingId: varchar('parent_booking_id', { length: 36 }),
  isRecurring: boolean('is_recurring').notNull(),
  accessCode: text('access_code'),
  accessCodeDeliveredAt: timestamp('access_code_delivered_at'),
  subjectPersonId: varchar('subject_person_id', { length: 36 }),
})

export const brands = mysqlTable('brands', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  color: text('color'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  iconUrl: text('icon_url'),
})

export const calendarCategories = mysqlTable('calendar_categories', {
  calendarId: varchar('calendar_id', { length: 36 }).notNull(),
  categoryId: varchar('category_id', { length: 36 }).notNull(),
}, (t) => [primaryKey({ columns: [t.calendarId, t.categoryId] })])

export const calendars = mysqlTable('calendars', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  pinToNav: boolean('pin_to_nav').notNull(),
  icon: text('icon'),
  color: text('color'),
  settings: json('settings'),
})

export const categories = mysqlTable('categories', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  parentId: varchar('parent_id', { length: 36 }),
  name: text('name').notNull(),
  color: text('color'),
  icon: text('icon'),
  defaultTc: text('default_tc'),
  defaultFormId: varchar('default_form_id', { length: 36 }),
  defaultXeroCodes: json('default_xero_codes'),
  defaultDisciplineId: varchar('default_discipline_id', { length: 36 }),
  disciplineIds: json('discipline_ids'),
  accessTypeKeys: json('access_type_keys'),
  accessPersonIds: json('access_person_ids'),
  defaultColumns: json('default_columns'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const circleMembers = mysqlTable('circle_members', {
  id: varchar('id', { length: 36 }).primaryKey(),
  circleId: varchar('circle_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  role: text('role').notNull(),
  canBookFor: boolean('can_book_for').notNull(),
  canView: boolean('can_view').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  isLead: boolean('is_lead').notNull(),
  canRegister: boolean('can_register').notNull(),
  relationship: text('relationship'),
  isPrimary: boolean('is_primary').notNull(),
  receivesComms: boolean('receives_comms').notNull(),
  contactType: text('contact_type'),
})

export const circles = mysqlTable('circles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  color: text('color'),
  imageUrl: text('image_url'),
})

export const clubTypes = mysqlTable('club_types', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  defaultModules: json('default_modules'),
  defaultPersonTypes: json('default_person_types'),
  defaultTerminology: json('default_terminology'),
  defaultEventCategories: json('default_event_categories'),
  isOverallDefault: boolean('is_overall_default').notNull(),
})

export const codeRoleDefs = mysqlTable('code_role_defs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  codeLineageId: varchar('code_lineage_id', { length: 36 }),
  key: text('key').notNull(),
  label: text('label').notNull(),
  capabilities: json('capabilities').notNull(),
  sortOrder: int('sort_order'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const codeStaff = mysqlTable('code_staff', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  codeLineageId: varchar('code_lineage_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  roleKey: text('role_key').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const commsPreferences = mysqlTable('comms_preferences', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  subjectPersonId: varchar('subject_person_id', { length: 36 }).notNull(),
  categories: json('categories').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const communicationTopics = mysqlTable('communication_topics', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }),
  name: text('name').notNull(),
  description: text('description'),
  channels: json('channels').notNull(),
  isCore: boolean('is_core').notNull(),
  sortOrder: int('sort_order').notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const communications = mysqlTable('communications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  audienceFilter: json('audience_filter'),
  recipientCount: int('recipient_count').notNull(),
  sentBy: text('sent_by'),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
})

export const connectionGroupEvents = mysqlTable('connection_group_events', {
  groupId: varchar('group_id', { length: 36 }).notNull(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
}, (t) => [primaryKey({ columns: [t.groupId, t.eventId] })])

export const connectionGroups = mysqlTable('connection_groups', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const customReports = mysqlTable('custom_reports', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  config: json('config').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const dashboardTemplates = mysqlTable('dashboard_templates', {
  orgId: varchar('org_id', { length: 36 }).notNull(),
  userType: varchar('user_type', { length: 191 }).notNull(),
  config: json('config'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.orgId, t.userType] })])

export const disciplineRequirements = mysqlTable('discipline_requirements', {
  id: varchar('id', { length: 36 }).primaryKey(),
  disciplineId: varchar('discipline_id', { length: 36 }).notNull(),
  fieldColumn: text('field_column'),
  fieldDefinitionId: varchar('field_definition_id', { length: 36 }),
  fieldKey: text('field_key'),
  operator: text('operator').notNull(),
  value: json('value'),
  exempt: boolean('exempt').notNull(),
  appliesTo: json('applies_to'),
  message: text('message'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  purpose: text('purpose').notNull(),
})

export const disciplines = mysqlTable('disciplines', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  sport: text('sport'),
  code: text('code'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  parentId: varchar('parent_id', { length: 36 }),
  appliesTo: json('applies_to'),
  personTypeKeys: json('person_type_keys'),
})

export const discounts = mysqlTable('discounts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  code: text('code'),
  modifierType: text('modifier_type').notNull(),
  modifierValue: decimal('modifier_value', { precision: 12, scale: 2 }).notNull(),
  usageCap: int('usage_cap'),
  perUserCap: int('per_user_cap'),
  expiresAt: timestamp('expires_at'),
  eligibility: json('eligibility'),
  linkedEventId: varchar('linked_event_id', { length: 36 }),
  minSessions: int('min_sessions'),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  formText: text('form_text'),
  validFrom: timestamp('valid_from'),
  applyTo: text('apply_to').notNull(),
  conditions: json('conditions').notNull(),
})

export const doors = mysqlTable('doors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  locationNote: text('location_note'),
  hardwareProvider: text('hardware_provider'),
  hardwareId: text('hardware_id'),
  defaultUnlockSeconds: int('default_unlock_seconds').notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const emailTemplates = mysqlTable('email_templates', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  key: text('key').notNull(),
  subject: text('subject').notNull(),
  body: text('body').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const entities = mysqlTable('entities', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  typeKey: text('type_key').notNull(),
  name: text('name').notNull(),
  customFields: json('custom_fields').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const entityMembers = mysqlTable('entity_members', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  entityId: varchar('entity_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  roles: json('roles').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const eventDisciplines = mysqlTable('event_disciplines', {
  eventId: varchar('event_id', { length: 36 }).notNull(),
  disciplineId: varchar('discipline_id', { length: 36 }).notNull(),
}, (t) => [primaryKey({ columns: [t.eventId, t.disciplineId] })])

export const eventNotes = mysqlTable('event_notes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  title: text('title'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const eventTasks = mysqlTable('event_tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  text: text('text').notNull(),
  done: boolean('done').notNull(),
  dueDate: date('due_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  assigneeIds: json('assignee_ids').notNull(),
  isRole: boolean('is_role').notNull(),
  roleCapacity: int('role_capacity').notNull(),
})

export const events = mysqlTable('events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  style: text('style').notNull(),
  status: text('status').notNull(),
  categoryId: varchar('category_id', { length: 36 }),
  secondaryCategoryId: varchar('secondary_category_id', { length: 36 }),
  // Full multi-select of categories; categoryId stays the primary (category_ids[0]).
  categoryIds: json('category_ids'),
  startAt: timestamp('start_at'),
  endAt: timestamp('end_at'),
  isAllDay: boolean('is_all_day').notNull(),
  recurrenceRule: text('recurrence_rule'),
  recurrenceParentId: varchar('recurrence_parent_id', { length: 36 }),
  locationType: text('location_type').notNull(),
  bookableId: varchar('bookable_id', { length: 36 }),
  address: text('address'),
  meetingLink: text('meeting_link'),
  capacityMin: int('capacity_min'),
  capacityMax: int('capacity_max'),
  showAttendeeList: boolean('show_attendee_list').notNull(),
  showAttendeeCount: boolean('show_attendee_count').notNull(),
  allowInterest: boolean('allow_interest').notNull(),
  allowGuests: boolean('allow_guests').notNull(),
  maxGuestsPerInvitee: int('max_guests_per_invitee'),
  holdSpotEnabled: boolean('hold_spot_enabled').notNull(),
  holdSpotAgeMax: int('hold_spot_age_max'),
  phasedRegistration: boolean('phased_registration').notNull(),
  memberWindowDays: int('member_window_days').notNull(),
  publicOpensAt: timestamp('public_opens_at'),
  masterEventId: varchar('master_event_id', { length: 36 }),
  sharingConfig: json('sharing_config'),
  bannerUrl: text('banner_url'),
  attachments: json('attachments'),
  tcContent: text('tc_content'),
  isFeatured: boolean('is_featured').notNull(),
  isPublic: boolean('is_public').notNull(),
  publicUrlSlug: text('public_url_slug'),
  formId: varchar('form_id', { length: 36 }),
  xeroCodesLocked: boolean('xero_codes_locked').notNull(),
  createdBy: varchar('created_by', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  locations: json('locations'),
  hasWaitlist: boolean('has_waitlist').notNull(),
  subGroups: json('sub_groups'),
  regOpenAt: timestamp('reg_open_at'),
  regCloseAt: timestamp('reg_close_at'),
  hasTickets: boolean('has_tickets').notNull(),
  publishAt: timestamp('publish_at'),
  notes: text('notes'),
  automation: json('automation'),
  exdates: json('exdates').notNull(),
  hideBanner: boolean('hide_banner').notNull(),
  memberGroupId: varchar('member_group_id', { length: 36 }),
  memberGroupScheduleId: varchar('member_group_schedule_id', { length: 36 }),
  createdVia: text('created_via'),
  invitationEmail: json('invitation_email'),
  isProgramme: boolean('is_programme').notNull(),
  ageMin: int('age_min'),
  ageMax: int('age_max'),
  genderRestriction: text('gender_restriction'),
})

export const feeComponents = mysqlTable('fee_components', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }),
  sessionId: varchar('session_id', { length: 36 }),
  name: text('name').notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  xeroCode: text('xero_code'),
  isLocked: boolean('is_locked').notNull(),
  depositPercent: decimal('deposit_percent', { precision: 12, scale: 2 }),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const feeRules = mysqlTable('fee_rules', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }),
  sessionId: varchar('session_id', { length: 36 }),
  feeComponentId: varchar('fee_component_id', { length: 36 }),
  conditionType: text('condition_type').notNull(),
  conditionValue: json('condition_value').notNull(),
  modifierType: text('modifier_type').notNull(),
  modifierValue: decimal('modifier_value', { precision: 12, scale: 2 }).notNull(),
  evaluationOrder: int('evaluation_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const fieldDefinitions = mysqlTable('field_definitions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  label: text('label').notNull(),
  key: text('key'),
  fieldType: text('field_type').notNull(),
  options: json('options'),
  isRequired: boolean('is_required').notNull(),
  helpText: text('help_text'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  rules: json('rules').notNull(),
  target: text('target').notNull(),
  meta: json('meta').notNull(),
  targets: json('targets').notNull(),
})

export const formFields = mysqlTable('form_fields', {
  id: varchar('id', { length: 36 }).primaryKey(),
  formId: varchar('form_id', { length: 36 }).notNull(),
  fieldType: text('field_type').notNull(),
  label: text('label').notNull(),
  placeholder: text('placeholder'),
  helpText: text('help_text'),
  isRequired: boolean('is_required').notNull(),
  isEventOnly: boolean('is_event_only').notNull(),
  options: json('options'),
  conditions: json('conditions'),
  pageNumber: int('page_number').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const formSubmissions = mysqlTable('form_submissions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  formId: varchar('form_id', { length: 36 }),
  contextType: text('context_type').notNull(),
  contextId: varchar('context_id', { length: 36 }),
  status: text('status').notNull(),
  submitterName: text('submitter_name'),
  submitterEmail: text('submitter_email'),
  submitterPhone: text('submitter_phone'),
  answers: json('answers').notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  discountTotal: decimal('discount_total', { precision: 12, scale: 2 }).notNull(),
  registrationId: varchar('registration_id', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const groupCodes = mysqlTable('group_codes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  color: text('color'),
  parentId: varchar('parent_id', { length: 36 }),
  termId: varchar('term_id', { length: 36 }),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  memberTypeKey: text('member_type_key'),
  lineageId: varchar('lineage_id', { length: 36 }),
  roleMinimums: json('role_minimums').notNull(),
  memberPositions: json('member_positions').notNull(),
  positionMinimums: json('position_minimums').notNull(),
  sportId: varchar('sport_id', { length: 36 }),
})

export const groupFeeOptionItems = mysqlTable('group_fee_option_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  optionId: varchar('option_id', { length: 36 }).notNull(),
  name: text('name'),
  amount: decimal('amount', { precision: 12, scale: 2 }),
  account: text('account'),
  sortOrder: int('sort_order'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const groupFeeOptions = mysqlTable('group_fee_options', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  groupId: varchar('group_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  feeType: text('fee_type').notNull(),
  periodUnit: text('period_unit'),
  periodCount: int('period_count'),
  autoRenew: boolean('auto_renew'),
  instalmentCount: int('instalment_count'),
  sessionCount: int('session_count'),
  prorata: boolean('prorata'),
  description: text('description'),
  sortOrder: int('sort_order'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  dueDate: date('due_date'),
  depositPercent: decimal('deposit_percent', { precision: 12, scale: 2 }),
})

export const groupViews = mysqlTable('group_views', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  config: json('config').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const helpArticles = mysqlTable('help_articles', {
  id: varchar('id', { length: 36 }).primaryKey(),
  key: text('key').notNull(),
  title: text('title').notNull(),
  explanation: text('explanation').notNull(),
  steps: json('steps').notNull(),
  module: text('module'),
  resource: text('resource'),
  route: text('route'),
  sortOrder: int('sort_order').notNull(),
  status: text('status').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// A whole affiliated CLUB invited to an event (governing-org "Clubs" tab). Unique
// (event_id, org_id) is enforced by the migration + the repo's check-then-insert.
export const eventOrgInvitees = mysqlTable('event_org_invitees', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  invitedByOrgId: varchar('invited_by_org_id', { length: 36 }),
  status: text('status').notNull(),
  // What the club chose to connect once it accepts ({event_details,fees,communication}).
  connections: json('connections'),
  // Optionally scope this invite to ONE discipline (null = the whole event).
  disciplineId: varchar('discipline_id', { length: 36 }),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  decidedAt: timestamp('decided_at'),
})

// A whole CALENDAR shared to an affiliated CLUB (the calendar-level twin of
// event_org_invitees). On accept, every event on that calendar — resolved by the
// calendar's category set — surfaces read-only on the club's own calendar. Unique
// (calendar_id, org_id) via the migration + the repo's check-then-insert.
export const calendarOrgInvitees = mysqlTable('calendar_org_invitees', {
  id: varchar('id', { length: 36 }).primaryKey(),
  calendarId: varchar('calendar_id', { length: 36 }).notNull(),
  orgId: varchar('org_id', { length: 36 }).notNull(),            // the invited club
  invitedByOrgId: varchar('invited_by_org_id', { length: 36 }),  // the sharing org
  status: text('status').notNull(),
  connections: json('connections'),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  decidedAt: timestamp('decided_at'),
})

export const invitees = mysqlTable('invitees', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  sessionId: varchar('session_id', { length: 36 }),
  personId: varchar('person_id', { length: 36 }),
  status: text('status').notNull(),
  holdExpiresAt: timestamp('hold_expires_at'),
  waitlistPosition: int('waitlist_position'),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  attended: boolean('attended').notNull().default(false),
  signedOut: boolean('signed_out').notNull().default(false),
  ticketType: text('ticket_type'),
  feeAmount: decimal('fee_amount', { precision: 12, scale: 2 }),
  paidAt: timestamp('paid_at'),
  subGroupId: text('sub_group_id'),
  roles: json('roles'),
  role: text('role'),
  respondedAt: timestamp('responded_at'),
  inviteSentAt: timestamp('invite_sent_at'),
  // The club that added this invitee (null = the event owner's own). Set when a club
  // invites its people to a SHARED event, so each club sees only its own invitees.
  clubOrgId: varchar('club_org_id', { length: 36 }),
})

export const lightZones = mysqlTable('light_zones', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  hardwareProvider: text('hardware_provider'),
  hardwareId: text('hardware_id'),
  defaultLevelPercent: int('default_level_percent').notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const locationStaff = mysqlTable('location_staff', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  locationId: varchar('location_id', { length: 36 }),
  personId: varchar('person_id', { length: 36 }).notNull(),
  roleKey: text('role_key').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sportId: varchar('sport_id', { length: 36 }),
})

export const locations = mysqlTable('locations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  address: text('address'),
  color: text('color'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const memberGroupDisciplines = mysqlTable('member_group_disciplines', {
  groupId: varchar('group_id', { length: 36 }).notNull(),
  disciplineId: varchar('discipline_id', { length: 36 }).notNull(),
}, (t) => [primaryKey({ columns: [t.groupId, t.disciplineId] })])

export const memberGroupMemberships = mysqlTable('member_group_memberships', {
  groupId: varchar('group_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  role: text('role'),
  roles: json('roles'),
  subGroupId: text('sub_group_id'),
  termId: varchar('term_id', { length: 36 }),
  planOptionId: varchar('plan_option_id', { length: 36 }),
  startDate: date('start_date'),
  endDate: date('end_date'),
  autoRenew: boolean('auto_renew'),
  membershipStatus: text('membership_status'),
  feeOptionId: varchar('fee_option_id', { length: 36 }),
  positions: json('positions').notNull(),
}, (t) => [primaryKey({ columns: [t.groupId, t.personId] })])

export const memberGroupPlans = mysqlTable('member_group_plans', {
  id: varchar('id', { length: 36 }).primaryKey(),
  groupId: varchar('group_id', { length: 36 }).notNull(),
  planId: varchar('plan_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const memberGroupSchedules = mysqlTable('member_group_schedules', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  groupId: varchar('group_id', { length: 36 }).notNull(),
  dayOfWeek: int('day_of_week').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  location: json('location').notNull(),
  name: text('name'),
})

export const memberGroupTerms = mysqlTable('member_group_terms', {
  id: varchar('id', { length: 36 }).primaryKey(),
  groupId: varchar('group_id', { length: 36 }).notNull(),
  termId: varchar('term_id', { length: 36 }).notNull(),
  fee: decimal('fee', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
})

export const memberGroups = mysqlTable('member_groups', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  color: text('color'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  parentId: varchar('parent_id', { length: 36 }),
  code: text('code'),
  ageRange: text('age_range'),
  capacity: int('capacity'),
  currentTerm: text('current_term'),
  termFee: decimal('term_fee', { precision: 12, scale: 2 }),
  subGroups: json('sub_groups').notNull(),
  termId: varchar('term_id', { length: 36 }),
  lineageId: varchar('lineage_id', { length: 36 }),
  rolledFromGroupId: varchar('rolled_from_group_id', { length: 36 }),
  genderRestriction: text('gender_restriction'),
  codeId: varchar('code_id', { length: 36 }),
  imageUrl: text('image_url'),
  headPersonId: varchar('head_person_id', { length: 36 }),
  waitlistId: varchar('waitlist_id', { length: 36 }),
  formId: varchar('form_id', { length: 36 }),
  discontinuedAt: timestamp('discontinued_at'),
  locationId: varchar('location_id', { length: 36 }),
  kind: text('kind').notNull(),
  membershipSettings: json('membership_settings'),
  locationIds: json('location_ids'),
})

export const membershipEntitlements = mysqlTable('membership_entitlements', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  membershipGroupId: varchar('membership_group_id', { length: 36 }).notNull(),
  targetType: text('target_type').notNull(),
  targetId: varchar('target_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order'),
  createdAt: timestamp('created_at').defaultNow(),
  benefitType: text('benefit_type').notNull(),
  benefitValue: decimal('benefit_value', { precision: 12, scale: 2 }),
})

export const membershipPlanOptions = mysqlTable('membership_plan_options', {
  id: varchar('id', { length: 36 }).primaryKey(),
  planId: varchar('plan_id', { length: 36 }).notNull(),
  name: text('name'),
  periodUnit: text('period_unit').notNull(),
  periodCount: int('period_count').notNull(),
  price: decimal('price', { precision: 12, scale: 2 }),
  autoRenew: boolean('auto_renew').notNull(),
  sortOrder: int('sort_order'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const membershipPlans = mysqlTable('membership_plans', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  status: text('status').notNull(),
  sortOrder: int('sort_order'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const notifications = mysqlTable('notifications', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  link: text('link'),
  payload: json('payload').notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  emailSentAt: timestamp('email_sent_at'),
})

export const orgManagerGrants = mysqlTable('org_manager_grants', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  targetOrgId: varchar('target_org_id', { length: 36 }),
  capabilities: json('capabilities').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const orgMembers = mysqlTable('org_members', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const orgSports = mysqlTable('org_sports', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  sport: text('sport').notNull(),
  nsoOrgId: varchar('nso_org_id', { length: 36 }),
  isPrimary: boolean('is_primary').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  displayName: text('display_name'),
  terminology: json('terminology'),
  affiliationStatus: text('affiliation_status').notNull(),
  requestedAt: timestamp('requested_at').defaultNow(),
  decidedAt: timestamp('decided_at'),
  decidedBy: varchar('decided_by', { length: 36 }),
})

export const orgTerms = mysqlTable('org_terms', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: text('status').notNull(),
  sortOrder: int('sort_order'),
  createdAt: timestamp('created_at').defaultNow(),
  signupOpen: date('signup_open'),
  signupClose: date('signup_close'),
  setId: varchar('set_id', { length: 36 }),
})

export const organisations = mysqlTable('organisations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  parentId: varchar('parent_id', { length: 36 }),
  slug: text('slug'),
  logoUrl: text('logo_url'),
  // varchar (not text): TiDB forbids a DEFAULT on TEXT/BLOB columns, and these are
  // short fixed-format codes ('NZD', 'en-NZ') that should never have been text.
  currency: varchar('currency', { length: 16 }).notNull().default('NZD'),
  locale: varchar('locale', { length: 16 }).notNull().default('en-NZ'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  defaultPaymentOptions: json('default_payment_options').notNull().default([]),
  defaultFormId: varchar('default_form_id', { length: 36 }),
  defaultPaymentMethod: text('default_payment_method'),
  defaultBankAccountId: varchar('default_bank_account_id', { length: 36 }),
  eventsDefaultPaymentOptions: json('events_default_payment_options').notNull().default([]),
  eventsDefaultPaymentMethod: text('events_default_payment_method'),
  eventsDefaultBankAccountId: varchar('events_default_bank_account_id', { length: 36 }),
  bookerTheme: json('booker_theme').notNull().default({}),
  seasonStart: date('season_start'),
  seasonEnd: date('season_end'),
  orgLevel: text('org_level').notNull(),
  memberFormId: varchar('member_form_id', { length: 36 }),
  terminology: json('terminology').notNull().default({}),
  defaultSportName: text('default_sport_name'),
  clubTypeIds: json('club_type_ids').notNull().default([]),
  brandId: varchar('brand_id', { length: 36 }),
  iconUrl: text('icon_url'),
  dashboardConfig: json('dashboard_config'),
  dashboardBannerUrl: text('dashboard_banner_url'),
  profileDashboard: json('profile_dashboard'),
  brandColor: text('brand_color'),
  brandTextColor: text('brand_text_color'),
  peopleColumns: json('people_columns'),
  coreFields: json('core_fields').notNull().default({}),
  defaultMemberPositions: json('default_member_positions').notNull().default([]),
  enabledModules: json('enabled_modules'),
  onboarding: json('onboarding'),
  shortName: text('short_name'),
  address: text('address'),
  country: text('country'),
  timezone: text('timezone'),
  email: text('email'),
  phone: text('phone'),
  website: text('website'),
  memberPullMode: text('member_pull_mode'),
  isSandbox: boolean('is_sandbox').notNull().default(false),
  // A fully-configured org marked as a reusable SETUP TEMPLATE: a new club can be
  // cloned from it (config/structure only — never its people or operational data).
  isTemplate: boolean('is_template').notNull().default(false),
})

export const pageComments = mysqlTable('page_comments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  path: text('path').notNull(),
  body: text('body').notNull(),
  authorId: varchar('author_id', { length: 36 }),
  authorName: text('author_name'),
  x: decimal('x', { precision: 12, scale: 2 }),
  y: decimal('y', { precision: 12, scale: 2 }),
  resolved: boolean('resolved').notNull(),
  resolvedBy: varchar('resolved_by', { length: 36 }),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewerId: varchar('reviewer_id', { length: 36 }),
  parentId: varchar('parent_id', { length: 36 }),
  anchorSelector: text('anchor_selector'),
})

export const pageReviewers = mysqlTable('page_reviewers', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  role: text('role'),
  color: text('color'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const pageReviews = mysqlTable('page_reviews', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  path: text('path').notNull(),
  stage: text('stage').notNull(),
  approvedBy: varchar('approved_by', { length: 36 }),
  approvedAt: timestamp('approved_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const pageSignoffs = mysqlTable('page_signoffs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  path: text('path').notNull(),
  reviewerId: varchar('reviewer_id', { length: 36 }).notNull(),
  signedByUserId: varchar('signed_by_user_id', { length: 36 }),
  note: text('note'),
  signedAt: timestamp('signed_at').notNull().defaultNow(),
})

export const permissionGroupMembers = mysqlTable('permission_group_members', {
  groupId: varchar('group_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.groupId, t.personId] })])

export const permissionGroups = mysqlTable('permission_groups', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }),
  name: text('name').notNull(),
  description: text('description'),
  permissions: json('permissions').notNull(),
  isSystem: boolean('is_system').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  isCore: boolean('is_core').notNull(),
  sourceGroupId: varchar('source_group_id', { length: 36 }),
})

export const personMemberships = mysqlTable('person_memberships', {
  id: varchar('id', { length: 36 }).primaryKey(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  disciplineId: varchar('discipline_id', { length: 36 }),
  sport: text('sport'),
  role: text('role').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const personNotes = mysqlTable('person_notes', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  body: text('body').notNull(),
  tags: json('tags').notNull(),
  authorId: varchar('author_id', { length: 36 }),
  authorName: text('author_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  links: json('links').notNull(),
  visibility: text('visibility').notNull(),
  isImportant: boolean('is_important').notNull(),
  visibleTo: json('visible_to').notNull(),
  dueDate: date('due_date'),
  channel: text('channel'),
})

export const personTargetTypes = mysqlTable('person_target_types', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }),
  key: text('key').notNull(),
  label: text('label').notNull(),
  minCount: int('min_count').notNull(),
  maxCount: int('max_count'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  kind: text('kind').notNull(),
  permissions: json('permissions').notNull(),
  memberSlots: json('member_slots').notNull(),
  isGlobal: boolean('is_global').notNull(),
  isAccess: boolean('is_access').notNull(),
  landingPath: text('landing_path'),
  profileDashboard: json('profile_dashboard'),
  menuItems: json('menu_items'),
  isPublished: boolean('is_published').notNull(),
})

export const personTypeLinks = mysqlTable('person_type_links', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  typeId: varchar('type_id', { length: 36 }).notNull(),
  sourceTypeId: varchar('source_type_id', { length: 36 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const persons = mysqlTable('persons', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  dob: date('dob'),
  gender: text('gender'),
  membershipType: text('membership_type'),
  customFields: json('custom_fields'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  photoUrl: text('photo_url'),
  personType: text('person_type'),
  personTypes: json('person_types'),
  commsTopics: json('comms_topics'),
  phone2: text('phone2'),
  invitedAt: timestamp('invited_at'),
})

export const physicalSchedules = mysqlTable('physical_schedules', {
  id: varchar('id', { length: 36 }).primaryKey(),
  bookingId: varchar('booking_id', { length: 36 }),
  eventId: varchar('event_id', { length: 36 }),
  sessionId: varchar('session_id', { length: 36 }),
  bookableId: varchar('bookable_id', { length: 36 }),
  doorId: varchar('door_id', { length: 36 }),
  lightZoneId: varchar('light_zone_id', { length: 36 }),
  scheduledOnAt: timestamp('scheduled_on_at').notNull(),
  scheduledOffAt: timestamp('scheduled_off_at').notNull(),
  levelPercent: int('level_percent'),
  overrideOnAt: timestamp('override_on_at'),
  overrideOffAt: timestamp('override_off_at'),
  deliveredAt: timestamp('delivered_at'),
  deliveryError: text('delivery_error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const pricingRules = mysqlTable('pricing_rules', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  bookableId: varchar('bookable_id', { length: 36 }),
  bookingTypeId: varchar('booking_type_id', { length: 36 }),
  pricingTierId: varchar('pricing_tier_id', { length: 36 }),
  label: text('label'),
  dayOfWeek: json('day_of_week'),
  timeFrom: time('time_from'),
  timeTo: time('time_to'),
  pricePerHour: decimal('price_per_hour', { precision: 12, scale: 2 }),
  flatPrice: decimal('flat_price', { precision: 12, scale: 2 }),
  halfDayPrice: decimal('half_day_price', { precision: 12, scale: 2 }),
  fullDayPrice: decimal('full_day_price', { precision: 12, scale: 2 }),
  isPeak: boolean('is_peak').notNull(),
  priority: int('priority').notNull(),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const profileForms = mysqlTable('profile_forms', {
  orgId: varchar('org_id', { length: 36 }).notNull(),
  typeKey: varchar('type_key', { length: 191 }).notNull(),
  config: json('config').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.orgId, t.typeKey] })])

export const registrationFormTargets = mysqlTable('registration_form_targets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  formId: varchar('form_id', { length: 36 }).notNull(),
  targetType: text('target_type').notNull(),
  targetId: varchar('target_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const registrationForms = mysqlTable('registration_forms', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  isTemplate: boolean('is_template').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  config: json('config').notNull(),
})

export const registrationSessions = mysqlTable('registration_sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  registrationId: varchar('registration_id', { length: 36 }).notNull(),
  sessionId: varchar('session_id', { length: 36 }).notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const registrationTicketItems = mysqlTable('registration_ticket_items', {
  id: varchar('id', { length: 36 }).primaryKey(),
  registrationId: varchar('registration_id', { length: 36 }).notNull(),
  ticketTypeId: varchar('ticket_type_id', { length: 36 }).notNull(),
  quantity: int('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 12, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const registrations = mysqlTable('registrations', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }),
  guestName: text('guest_name'),
  guestEmail: text('guest_email'),
  status: text('status').notNull(),
  ticketId: text('ticket_id'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 12, scale: 2 }).notNull(),
  holdExpiresAt: timestamp('hold_expires_at'),
  parentEmail: text('parent_email'),
  parentConfirmedAt: timestamp('parent_confirmed_at'),
  formAnswers: json('form_answers'),
  discountIds: json('discount_ids'),
  appliedDiscountTotal: decimal('applied_discount_total', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  checkedInAt: timestamp('checked_in_at'),
})

export const resourceFolders = mysqlTable('resource_folders', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  parentId: varchar('parent_id', { length: 36 }),
  name: text('name').notNull(),
  overrideTargets: boolean('override_targets').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const resourceTargets = mysqlTable('resource_targets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  ownerType: text('owner_type').notNull(),
  ownerId: varchar('owner_id', { length: 36 }).notNull(),
  targetType: text('target_type').notNull(),
  targetId: varchar('target_id', { length: 36 }).notNull(),
  sortOrder: int('sort_order'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const resourceViews = mysqlTable('resource_views', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  resourceId: varchar('resource_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }),
  userId: varchar('user_id', { length: 36 }),
  kind: text('kind').notNull(),
  seconds: int('seconds'),
  source: text('source'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const resources = mysqlTable('resources', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  folderId: varchar('folder_id', { length: 36 }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  description: text('description'),
  overrideTargets: boolean('override_targets').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const scopedRoleDefs = mysqlTable('scoped_role_defs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  resourceType: text('resource_type').notNull(),
  key: text('key').notNull(),
  label: text('label').notNull(),
  roleGroup: text('role_group').notNull(),
  capabilities: json('capabilities').notNull(),
  fieldType: text('field_type'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const sessions = mysqlTable('sessions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  parentSessionId: varchar('parent_session_id', { length: 36 }),
  title: text('title').notNull(),
  description: text('description'),
  startAt: timestamp('start_at'),
  endAt: timestamp('end_at'),
  locationType: text('location_type').notNull(),
  bookableId: varchar('bookable_id', { length: 36 }),
  address: text('address'),
  meetingLink: text('meeting_link'),
  isRequired: boolean('is_required').notNull(),
  capacityMin: int('capacity_min'),
  capacityMax: int('capacity_max'),
  visibilityRule: json('visibility_rule'),
  restrictions: json('restrictions'),
  accessProfileId: varchar('access_profile_id', { length: 36 }),
  lightingProfileId: varchar('lighting_profile_id', { length: 36 }),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  sessionKind: text('session_kind').notNull(),
  showAsSeparateEvent: boolean('show_as_separate_event').notNull(),
  hasWaitlist: boolean('has_waitlist').notNull(),
  isPublic: boolean('is_public').notNull(),
  showAttendeeList: boolean('show_attendee_list').notNull(),
  isAllDay: boolean('is_all_day').notNull(),
  displayOnForm: boolean('display_on_form').notNull(),
  isMaster: boolean('is_master').notNull(),
  masterId: varchar('master_id', { length: 36 }),
  inviteeModes: json('invitee_modes'),
  inviteeGroups: json('invitee_groups'),
  eligibility: json('eligibility'),
  admins: json('admins').notNull(),
  addons: json('addons').notNull(),
  exdates: json('exdates').notNull(),
})

export const sportCategories = mysqlTable('sport_categories', {
  id: varchar('id', { length: 36 }).primaryKey(),
  name: text('name').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tasks = mysqlTable('tasks', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dueAt: timestamp('due_at'),
  assigneeId: varchar('assignee_id', { length: 36 }),
  linkedPersonId: varchar('linked_person_id', { length: 36 }),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const termSets = mysqlTable('term_sets', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sportId: varchar('sport_id', { length: 36 }),
  locationIds: json('location_ids'),
})

export const ticketTypes = mysqlTable('ticket_types', {
  id: varchar('id', { length: 36 }).primaryKey(),
  eventId: varchar('event_id', { length: 36 }).notNull(),
  sessionId: varchar('session_id', { length: 36 }),
  name: text('name').notNull(),
  description: text('description'),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  capacity: int('capacity'),
  sortOrder: int('sort_order').notNull(),
  salesOpenAt: timestamp('sales_open_at'),
  salesCloseAt: timestamp('sales_close_at'),
  isActive: boolean('is_active').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const transactions = mysqlTable('transactions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  registrationId: varchar('registration_id', { length: 36 }).notNull(),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  type: text('type').notNull(),
  paymentMethod: text('payment_method'),
  xeroInvoiceId: text('xero_invoice_id'),
  xeroStatus: text('xero_status'),
  refundReason: text('refund_reason'),
  processedBy: varchar('processed_by', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const userDashboards = mysqlTable('user_dashboards', {
  userId: varchar('user_id', { length: 36 }).notNull(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  config: json('config'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.orgId] })])

export const waitlistEntries = mysqlTable('waitlist_entries', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  waitlistId: varchar('waitlist_id', { length: 36 }).notNull(),
  personId: varchar('person_id', { length: 36 }).notNull(),
  status: text('status').notNull(),
  notes: text('notes'),
  sortOrder: int('sort_order').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  priority: int('priority').notNull(),
})

export const waitlists = mysqlTable('waitlists', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  name: text('name').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  orderMode: text('order_mode').notNull(),
  termId: varchar('term_id', { length: 36 }),
  lineageId: varchar('lineage_id', { length: 36 }),
  rolledFromId: varchar('rolled_from_id', { length: 36 }),
})

export const xeroConnections = mysqlTable('xero_connections', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  tenantId: text('tenant_id').notNull(),
  tenantName: text('tenant_name'),
  refreshToken: text('refresh_token').notNull(),
  accessToken: text('access_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  salesAccountCode: text('sales_account_code'),
  bankAccountCode: text('bank_account_code'),
  bankAccountName: text('bank_account_name'),
  taxType: text('tax_type'),
  feeAccounts: json('fee_accounts'),
  status: text('status').notNull(),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const xeroSyncErrors = mysqlTable('xero_sync_errors', {
  id: varchar('id', { length: 36 }).primaryKey(),
  orgId: varchar('org_id', { length: 36 }).notNull(),
  assocType: text('assoc_type'),
  assocId: varchar('assoc_id', { length: 36 }),
  action: text('action'),
  endpoint: text('endpoint'),
  message: text('message'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
