// The client side of the seam for the bookings domain. Components call this — never
// useDb(), never Supabase, never $fetch to a raw table. It returns fully-typed
// domain objects (the shared contract), so a component has no idea whether the data
// came from MySQL today or the backend team's API tomorrow.
//
// This follows the use<Thing>Api() template every migrated screen uses: typed
// $fetch to /api/v1/*.
import type {
  Bookable,
  Activity,
  ActivityMode,
  Booking,
  BookableCreate,
  BookablePatch,
  ActivityCreate,
  ActivityPatch,
} from '../shared/contracts/booking'

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
  /** Create a bookable. */
  async function createBookable(input: BookableCreate): Promise<Bookable> {
    return await $fetch<Bookable>('/api/v1/bookables', { method: 'POST', body: input })
  }
  /** Update a bookable. */
  async function updateBookable(id: string, patch: BookablePatch): Promise<Bookable> {
    return await $fetch<Bookable>(`/api/v1/bookables/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a bookable. */
  async function removeBookable(id: string): Promise<void> {
    await $fetch(`/api/v1/bookables/${id}`, { method: 'DELETE' })
  }
  /** Create an activity. */
  async function createActivity(input: ActivityCreate): Promise<Activity> {
    return await $fetch<Activity>('/api/v1/activities', { method: 'POST', body: input })
  }
  /** Update an activity. */
  async function updateActivity(id: string, patch: ActivityPatch): Promise<Activity> {
    return await $fetch<Activity>(`/api/v1/activities/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete an activity. */
  async function removeActivity(id: string): Promise<void> {
    await $fetch(`/api/v1/activities/${id}`, { method: 'DELETE' })
  }
  return {
    bookables, bookable, activities, activity, activityModes, bookings,
    createBookable, updateBookable, removeBookable,
    createActivity, updateActivity, removeActivity,
  }
}
