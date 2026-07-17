// The client side of the seam for events. Components call this — never useDb(),
// never Supabase, never $fetch to a raw table. It returns fully-typed domain
// objects (the shared contract), so a component has no idea whether the data came
// from MySQL today or the backend team's API tomorrow.
//
// This follows the use<Thing>Api() template: typed $fetch to /api/v1/*.
import type {
  FMEvent,
  Session,
  Invitee,
  Registration,
} from '../shared/contracts/event'

export function useEventsApi() {
  /** Every event for an org, newest first. Optional limit/offset for paging. */
  async function list(
    orgId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<FMEvent[]> {
    return await $fetch<FMEvent[]>('/api/v1/events', {
      query: { orgId, limit: opts.limit, offset: opts.offset },
    })
  }
  /** One event by id. */
  async function get(id: string): Promise<FMEvent> {
    return await $fetch<FMEvent>(`/api/v1/events/${id}`)
  }
  /** The sessions (occurrences) of an event. */
  async function sessions(eventId: string): Promise<Session[]> {
    return await $fetch<Session[]>(`/api/v1/events/${eventId}/sessions`)
  }
  /** The invitees of an event. */
  async function invitees(eventId: string): Promise<Invitee[]> {
    return await $fetch<Invitee[]>(`/api/v1/events/${eventId}/invitees`)
  }
  /** The registrations of an event. */
  async function registrations(eventId: string): Promise<Registration[]> {
    return await $fetch<Registration[]>(`/api/v1/events/${eventId}/registrations`)
  }
  return { list, get, sessions, invitees, registrations }
}
