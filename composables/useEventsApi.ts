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
  FMEventCreate,
  FMEventPatch,
  SessionCreate,
  SessionPatch,
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
  /** Create an event. */
  async function create(input: FMEventCreate): Promise<FMEvent> {
    return await $fetch<FMEvent>('/api/v1/events', { method: 'POST', body: input })
  }
  /** Update an event. */
  async function update(id: string, patch: FMEventPatch): Promise<FMEvent> {
    return await $fetch<FMEvent>(`/api/v1/events/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete an event. */
  async function remove(id: string): Promise<void> {
    await $fetch(`/api/v1/events/${id}`, { method: 'DELETE' })
  }
  /** Create a session under an event (posts nested, beside the read route). */
  async function createSession(input: SessionCreate): Promise<Session> {
    return await $fetch<Session>(`/api/v1/events/${input.eventId}/sessions`, { method: 'POST', body: input })
  }
  /** Update a session by its id. */
  async function updateSession(id: string, patch: SessionPatch): Promise<Session> {
    return await $fetch<Session>(`/api/v1/sessions/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a session by its id. */
  async function removeSession(id: string): Promise<void> {
    await $fetch(`/api/v1/sessions/${id}`, { method: 'DELETE' })
  }
  return {
    list, get, sessions, invitees, registrations,
    create, update, remove,
    createSession, updateSession, removeSession,
  }
}
