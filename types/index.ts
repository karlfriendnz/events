// Re-export fee types from composable so everything is importable from one place
export type { FeeLineItem, FeeGroup, SessionFeesConfig, RegistrationTypeFees, PersonTypeFeeGroup } from '~/composables/useFeeGroups'

// ─── Organisation ────────────────────────────────────────────────────────────

export interface Org {
  id: string
  name: string
  slug: string
}

// ─── Member groups ───────────────────────────────────────────────────────────

export interface MemberGroup {
  id: string
  org_id: string
  name: string
  color: string | null
}

// ─── Bookables (venues) ───────────────────────────────────────────────────────

export type BookableType = 'VENUE' | 'AREA' | 'LANE' | 'COURT' | 'ROOM'
export type BookableStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED'
export type BookingLimitType = 'none' | 'per_time_range' | 'per_day' | 'per_week' | 'per_month'

export interface Bookable {
  id: string
  org_id: string
  name: string
  internal_name: string | null
  description: string | null
  type: BookableType
  status: BookableStatus
  parent_id: string | null
  master_id: string | null
  max_concurrent: number
  rules: string | null
  booking_limit_type: BookingLimitType
  booking_limit_count: number | null
  disallow_concurrent: boolean
  disallow_consecutive: boolean
  allow_modes_with_others: boolean
  is_public: boolean
  show_in_menu: boolean
  location: string | null
  images: string[]
  main_image: string | null
  sponsor_image: string | null
  sports: string[]
  features: string[]
  sections: string[] | null
  space_type: string
  default_booking_view: string
  allow_multiple_layouts: boolean
}

export interface BookableMode {
  id: string
  bookable_id: string
  name: string
  description: string | null
  color: string | null
  image_url: string | null
  sort_order: number
  activity_mode_ids: string[]
}

export interface AvailabilityRule {
  id: string
  bookable_id: string
  name: string
  type: 'available' | 'unavailable'
  days: number[]            // 0=Sun … 6=Sat
  start_time: string        // 'HH:MM'
  end_time: string          // 'HH:MM'
  valid_from: string | null // ISO date
  valid_until: string | null
}

// ─── Activities ───────────────────────────────────────────────────────────────

export type ActivityStatus = 'ACTIVE' | 'ARCHIVED'
export type ApprovalMode = 'auto' | 'manual'

export interface Activity {
  id: string
  org_id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  status: ActivityStatus
  require_mode: boolean
  approval_mode: ApprovalMode
  booking_window_days: number | null
  min_notice_hours: number | null
  cancellation_window_hours: number | null
  min_duration_mins: number | null
  max_duration_mins: number | null
  buffer_mins: number | null
}

export interface ActivityMode {
  id: string
  activity_id: string
  name: string
  description: string | null
  color: string | null
  image_url: string | null
  sort_order: number
  pricing: ActivityModePricing
  addons: ActivityModeAddon[]
  allow_visitors: boolean
  min_people: number | null
  max_people: number | null
  min_visitors: number | null
  max_visitors: number | null
}

export interface ActivityModePricing {
  base: import('~/composables/useFeeGroups').FeeLineItem[]
  per_person: import('~/composables/useFeeGroups').FeeLineItem[]
  per_hour: import('~/composables/useFeeGroups').FeeLineItem[]
  tiers: PricingTier[]
}

export interface PricingTier {
  id: string
  name: string
  criteria: string
  group_id: string | null
  base: import('~/composables/useFeeGroups').FeeLineItem[] | null
  per_person: import('~/composables/useFeeGroups').FeeLineItem[] | null
  per_hour: import('~/composables/useFeeGroups').FeeLineItem[] | null
  addon_overrides: { addon_id: string; fees: import('~/composables/useFeeGroups').FeeLineItem[] }[]
}

export interface ActivityModeAddon {
  id: string
  name: string
  description: string
  fees: import('~/composables/useFeeGroups').FeeLineItem[]
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED'

export interface FMEvent {
  id: string
  org_id: string
  name: string
  description: string | null
  status: EventStatus
  start_at: string | null
  end_at: string | null
  location: string | null
  banner_url: string | null
}

export interface Session {
  id: string
  event_id: string
  name: string | null
  start_at: string
  end_at: string
  status: string
  fees: import('~/composables/useFeeGroups').SessionFeesConfig
  addons: SessionAddon[]
  attendee_count: number | null
}

export interface SessionAddon {
  id: string
  name: string
  description: string
  qty_available: number | null
  seats_per_unit: number | null
  fees: import('~/composables/useFeeGroups').FeeLineItem[]
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

export interface Booking {
  id: string
  org_id: string
  bookable_id: string
  activity_id: string | null
  activity_mode_id: string | null
  start_at: string
  end_at: string
  status: BookingStatus
  notes: string | null
  attendee_count: number | null
  created_at: string
}
