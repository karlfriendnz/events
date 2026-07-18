// The client side of the seam for the bookings domain. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the data
// came from MySQL today or the backend team's API tomorrow.
//
// This follows the use<Thing>Api() template every migrated screen uses: typed
// $fetch to /api/v1/*. It covers the whole booking engine — bookables + their
// modes/availability/configurations/access links, activities + their modes/scope/
// required-items, bookings + their items, booking discounts, and the org-wide
// door/light catalogue.
import type {
  Bookable, BookableCreate, BookablePatch,
  BookableMode,
  Activity, ActivityCreate, ActivityPatch,
  ActivityMode, ActivityModeCreate, ActivityModePatch,
  AvailabilityRule, AvailabilityRuleCreate,
  BookableConfigurationFull,
  Door, DoorCreate, DoorPatch,
  LightZone, LightZoneCreate, LightZonePatch,
  BookingDiscount,
  ActivityModeBookable, ActivityModeResource, ActivityModeRequiredItem, ActivityBookable,
  Booking, BookingCreate,
} from '../shared/contracts/booking'

export function useBookingsApi() {
  // ── Bookables ──
  /** Every bookable an org owns. */
  async function bookables(orgId: string): Promise<Bookable[]> {
    return await $fetch<Bookable[]>('/api/v1/bookables', { query: { orgId } })
  }
  /** One bookable by id. */
  async function bookable(id: string): Promise<Bookable> {
    return await $fetch<Bookable>(`/api/v1/bookables/${id}`)
  }
  async function createBookable(input: BookableCreate): Promise<Bookable> {
    return await $fetch<Bookable>('/api/v1/bookables', { method: 'POST', body: input })
  }
  async function updateBookable(id: string, patch: BookablePatch): Promise<Bookable> {
    return await $fetch<Bookable>(`/api/v1/bookables/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeBookable(id: string): Promise<void> {
    await $fetch(`/api/v1/bookables/${id}`, { method: 'DELETE' })
  }

  // ── Bookable modes ──
  async function bookableModes(bookableId: string): Promise<BookableMode[]> {
    return await $fetch<BookableMode[]>(`/api/v1/bookables/${bookableId}/modes`)
  }

  // ── Availability rules ──
  async function availabilityRules(bookableId: string): Promise<AvailabilityRule[]> {
    return await $fetch<AvailabilityRule[]>(`/api/v1/bookables/${bookableId}/availability`)
  }
  /** Replace a bookable's whole availability rule set (delete-then-insert). */
  async function replaceAvailabilityRules(bookableId: string, rules: AvailabilityRuleCreate[]): Promise<AvailabilityRule[]> {
    return await $fetch<AvailabilityRule[]>(`/api/v1/bookables/${bookableId}/availability`, { method: 'POST', body: rules })
  }

  // ── Configurations ──
  async function configurations(parentBookableId: string): Promise<BookableConfigurationFull[]> {
    return await $fetch<BookableConfigurationFull[]>(`/api/v1/bookables/${parentBookableId}/configurations`)
  }
  /** Idempotent slot-aware save; returns the configuration id (or null). */
  async function saveConfiguration(
    parentBookableId: string,
    key: string,
    name: string,
    slots: { name: string; childIds: string[] }[],
  ): Promise<string | null> {
    const res = await $fetch<{ configId: string | null }>(`/api/v1/bookables/${parentBookableId}/configurations`, {
      method: 'POST', body: { key, name, slots },
    })
    return res.configId
  }
  async function deleteConfiguration(configId: string): Promise<void> {
    await $fetch(`/api/v1/bookable-configurations/${configId}`, { method: 'DELETE' })
  }

  // ── Bookable ↔ door / light-zone links ──
  async function bookableDoors(bookableId: string): Promise<string[]> {
    return await $fetch<string[]>(`/api/v1/bookables/${bookableId}/doors`)
  }
  async function setBookableDoors(bookableId: string, doorIds: string[]): Promise<void> {
    await $fetch(`/api/v1/bookables/${bookableId}/doors`, { method: 'POST', body: { doorIds } })
  }
  async function bookableLightZones(bookableId: string): Promise<string[]> {
    return await $fetch<string[]>(`/api/v1/bookables/${bookableId}/light-zones`)
  }
  async function setBookableLightZones(bookableId: string, zoneIds: string[]): Promise<void> {
    await $fetch(`/api/v1/bookables/${bookableId}/light-zones`, { method: 'POST', body: { zoneIds } })
  }

  // ── Doors ──
  async function doors(orgId: string): Promise<Door[]> {
    return await $fetch<Door[]>('/api/v1/doors', { query: { orgId } })
  }
  async function createDoor(input: DoorCreate): Promise<Door> {
    return await $fetch<Door>('/api/v1/doors', { method: 'POST', body: input })
  }
  async function updateDoor(id: string, patch: DoorPatch): Promise<Door> {
    return await $fetch<Door>(`/api/v1/doors/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeDoor(id: string): Promise<void> {
    await $fetch(`/api/v1/doors/${id}`, { method: 'DELETE' })
  }

  // ── Light zones ──
  async function lightZones(orgId: string): Promise<LightZone[]> {
    return await $fetch<LightZone[]>('/api/v1/light-zones', { query: { orgId } })
  }
  async function createLightZone(input: LightZoneCreate): Promise<LightZone> {
    return await $fetch<LightZone>('/api/v1/light-zones', { method: 'POST', body: input })
  }
  async function updateLightZone(id: string, patch: LightZonePatch): Promise<LightZone> {
    return await $fetch<LightZone>(`/api/v1/light-zones/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeLightZone(id: string): Promise<void> {
    await $fetch(`/api/v1/light-zones/${id}`, { method: 'DELETE' })
  }

  // ── Activities ──
  async function activities(orgId: string): Promise<Activity[]> {
    return await $fetch<Activity[]>('/api/v1/activities', { query: { orgId } })
  }
  async function activity(id: string): Promise<Activity> {
    return await $fetch<Activity>(`/api/v1/activities/${id}`)
  }
  async function createActivity(input: ActivityCreate): Promise<Activity> {
    return await $fetch<Activity>('/api/v1/activities', { method: 'POST', body: input })
  }
  async function updateActivity(id: string, patch: ActivityPatch): Promise<Activity> {
    return await $fetch<Activity>(`/api/v1/activities/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeActivity(id: string): Promise<void> {
    await $fetch(`/api/v1/activities/${id}`, { method: 'DELETE' })
  }
  async function activityBookables(activityId: string): Promise<ActivityBookable[]> {
    return await $fetch<ActivityBookable[]>(`/api/v1/activities/${activityId}/bookables`)
  }
  /** Every activity linked to (or tagged with) a bookable — reverse of activity_bookables. */
  async function bookableActivities(bookableId: string): Promise<Activity[]> {
    return await $fetch<Activity[]>(`/api/v1/bookables/${bookableId}/activities`)
  }
  async function setActivityBookables(activityId: string, bookableIds: string[]): Promise<void> {
    await $fetch(`/api/v1/activities/${activityId}/bookables`, { method: 'POST', body: { bookableIds } })
  }
  /** Append bookable links to an activity without replacing its existing ones. */
  async function addActivityBookables(activityId: string, bookableIds: string[]): Promise<void> {
    await $fetch(`/api/v1/activities/${activityId}/bookables-add`, { method: 'POST', body: { bookableIds } })
  }
  async function activityGroups(activityId: string): Promise<string[]> {
    return await $fetch<string[]>(`/api/v1/activities/${activityId}/groups`)
  }
  async function setActivityGroups(activityId: string, groupIds: string[]): Promise<void> {
    await $fetch(`/api/v1/activities/${activityId}/groups`, { method: 'POST', body: { groupIds } })
  }

  // ── Activity modes ──
  async function activityModes(activityId: string): Promise<ActivityMode[]> {
    return await $fetch<ActivityMode[]>(`/api/v1/activities/${activityId}/modes`)
  }
  async function activityMode(id: string): Promise<ActivityMode> {
    return await $fetch<ActivityMode>(`/api/v1/activity-modes/${id}`)
  }
  async function createActivityMode(input: ActivityModeCreate): Promise<ActivityMode> {
    return await $fetch<ActivityMode>('/api/v1/activity-modes', { method: 'POST', body: input })
  }
  async function updateActivityMode(id: string, patch: ActivityModePatch): Promise<ActivityMode> {
    return await $fetch<ActivityMode>(`/api/v1/activity-modes/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeActivityMode(id: string): Promise<void> {
    await $fetch(`/api/v1/activity-modes/${id}`, { method: 'DELETE' })
  }
  async function modeBookables(modeId: string): Promise<ActivityModeBookable[]> {
    return await $fetch<ActivityModeBookable[]>(`/api/v1/activity-modes/${modeId}/bookables`)
  }
  async function setModeBookables(modeId: string, rows: { bookableId: string; priceOverride?: string | number | null }[]): Promise<void> {
    await $fetch(`/api/v1/activity-modes/${modeId}/bookables`, { method: 'POST', body: { rows } })
  }
  async function modeResources(modeId: string): Promise<ActivityModeResource[]> {
    return await $fetch<ActivityModeResource[]>(`/api/v1/activity-modes/${modeId}/resources`)
  }
  async function setModeResources(modeId: string, bookableIds: string[]): Promise<void> {
    await $fetch(`/api/v1/activity-modes/${modeId}/resources`, { method: 'POST', body: { bookableIds } })
  }
  async function modeRequiredItems(modeId: string): Promise<ActivityModeRequiredItem[]> {
    return await $fetch<ActivityModeRequiredItem[]>(`/api/v1/activity-modes/${modeId}/required-items`)
  }
  async function setModeRequiredItems(modeId: string, items: { bookableId: string; quantity?: number; sortOrder?: number; isOptional?: boolean; priceOverride?: string | number | null }[]): Promise<void> {
    await $fetch(`/api/v1/activity-modes/${modeId}/required-items`, { method: 'POST', body: { items } })
  }

  // ── Booking discounts (NB the plain list read lives on the finance-owned
  // /api/v1/booking-discounts; this scoped read + writes are booking-domain). ──
  async function bookingDiscounts(orgId: string, opts?: { activeOnly?: boolean }): Promise<BookingDiscount[]> {
    return await $fetch<BookingDiscount[]>('/api/v1/booking-discounts/scoped', {
      query: { orgId, ...(opts?.activeOnly ? { activeOnly: '1' } : {}) },
    })
  }
  async function saveBookingDiscount(input: {
    id?: string; orgId: string; name: string; formText?: string | null; modifierType: string;
    modifierValue: number | string; applyTo: string; conditions: any[]; validFrom?: string | null;
    validUntil?: string | null; maxUses?: number | null; isActive: boolean; activityIds: string[]; modeIds: string[]
  }): Promise<BookingDiscount> {
    return await $fetch<BookingDiscount>('/api/v1/booking-discounts', { method: 'POST', body: input })
  }
  async function removeBookingDiscount(id: string): Promise<void> {
    await $fetch(`/api/v1/booking-discounts/${id}`, { method: 'DELETE' })
  }

  // ── Bookings ──
  /** An org's bookings, newest first; optional paging / filters. */
  async function bookings(
    orgId: string,
    opts?: { limit?: number; offset?: number; status?: string },
  ): Promise<Booking[]> {
    return await $fetch<Booking[]>('/api/v1/bookings', {
      query: {
        orgId,
        ...(opts?.limit != null ? { limit: opts.limit } : {}),
        ...(opts?.offset != null ? { offset: opts.offset } : {}),
        ...(opts?.status ? { status: opts.status } : {}),
      },
    })
  }
  async function createBooking(input: BookingCreate): Promise<Booking> {
    return await $fetch<Booking>('/api/v1/bookings', { method: 'POST', body: input })
  }
  async function createBookings(inputs: BookingCreate[]): Promise<Booking[]> {
    return await $fetch<Booking[]>('/api/v1/bookings/batch', { method: 'POST', body: inputs })
  }
  async function setBookingStatus(id: string, status: string): Promise<void> {
    await $fetch(`/api/v1/bookings/${id}`, { method: 'PATCH', body: { status } })
  }
  async function removeBooking(id: string): Promise<void> {
    await $fetch(`/api/v1/bookings/${id}`, { method: 'DELETE' })
  }

  return {
    bookables, bookable, createBookable, updateBookable, removeBookable,
    bookableModes,
    availabilityRules, replaceAvailabilityRules,
    configurations, saveConfiguration, deleteConfiguration,
    bookableDoors, setBookableDoors, bookableLightZones, setBookableLightZones,
    doors, createDoor, updateDoor, removeDoor,
    lightZones, createLightZone, updateLightZone, removeLightZone,
    activities, activity, createActivity, updateActivity, removeActivity,
    activityBookables, bookableActivities, setActivityBookables, addActivityBookables, activityGroups, setActivityGroups,
    activityModes, activityMode, createActivityMode, updateActivityMode, removeActivityMode,
    modeBookables, setModeBookables, modeResources, setModeResources,
    modeRequiredItems, setModeRequiredItems,
    bookingDiscounts, saveBookingDiscount, removeBookingDiscount,
    bookings, createBooking, createBookings, setBookingStatus, removeBooking,
  }
}
