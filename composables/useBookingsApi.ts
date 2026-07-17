// The client side of the seam for the bookings domain. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the data
// came from MySQL today or the backend team's API tomorrow.
//
// This follows the use<Thing>Api() template every migrated screen uses: typed
// $fetch to /api/v1/*.
import type { Bookable, Activity, ActivityMode, Booking } from '../shared/contracts/booking'

export function useBookingsApi() {
  /** Every bookable an org owns. */
  async function bookables(orgId: string): Promise<Bookable[]> {
    return await $fetch<Bookable[]>('/api/v1/bookables', { query: { orgId } })
  }
  /** One bookable by id. */
  async function bookable(id: string): Promise<Bookable> {
    return await $fetch<Bookable>(`/api/v1/bookables/${id}`)
  }
  /** Every activity an org offers. */
  async function activities(orgId: string): Promise<Activity[]> {
    return await $fetch<Activity[]>('/api/v1/activities', { query: { orgId } })
  }
  /** One activity by id. */
  async function activity(id: string): Promise<Activity> {
    return await $fetch<Activity>(`/api/v1/activities/${id}`)
  }
  /** The modes of one activity. */
  async function activityModes(activityId: string): Promise<ActivityMode[]> {
    return await $fetch<ActivityMode[]>(`/api/v1/activities/${activityId}/modes`)
  }
  /** An org's bookings, newest first; optional paging. */
  async function bookings(
    orgId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<Booking[]> {
    return await $fetch<Booking[]>('/api/v1/bookings', {
      query: { orgId, ...(opts?.limit != null ? { limit: opts.limit } : {}), ...(opts?.offset != null ? { offset: opts.offset } : {}) },
    })
  }
  return { bookables, bookable, activities, activity, activityModes, bookings }
}
