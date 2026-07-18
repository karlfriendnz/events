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
  InviteeWithPerson,
  Registration,
  InviteeForPerson,
  TicketOrder,
  SeriesEvent,
  FMEventCreate,
  FMEventPatch,
  SessionCreate,
  SessionPatch,
  FeeComponent,
  FeeComponentCreate,
  FeeComponentPatch,
  EventNote,
  EventNoteCreate,
  EventNotePatch,
  EventTask,
  EventTaskCreate,
  EventTaskPatch,
  EventCategory,
  EventCategoryCreate,
  EventCategoryPatch,
  TicketType,
  TicketTypeCreate,
  TicketTypePatch,
  RegistrationSession,
  RegistrationCreate,
  RegistrationPatch,
  ConnectionGroup,
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
  /**
   * The sessions (occurrences) of an event. Default = every session; pass
   * `{ masters: true }` for only top-level sessions, or `{ parentSessionId }` for one
   * parent's sub-sessions.
   */
  async function sessions(
    eventId: string,
    opts: { masters?: boolean; parentSessionId?: string } = {},
  ): Promise<Session[]> {
    return await $fetch<Session[]>(`/api/v1/events/${eventId}/sessions`, {
      query: { masters: opts.masters ? '1' : undefined, parentSessionId: opts.parentSessionId },
    })
  }
  /** The invitees of an event. */
  async function invitees(eventId: string): Promise<Invitee[]> {
    return await $fetch<Invitee[]>(`/api/v1/events/${eventId}/invitees`)
  }
  /** The invitees of an event joined to their persons row (name/email/dob). */
  async function inviteesWithPerson(eventId: string): Promise<InviteeWithPerson[]> {
    return await $fetch<InviteeWithPerson[]>(`/api/v1/events/${eventId}/invitees-with-person`)
  }
  /** The registrations of an event. */
  async function registrations(eventId: string): Promise<Registration[]> {
    return await $fetch<Registration[]>(`/api/v1/events/${eventId}/registrations`)
  }
  /** Every invitee row for one person across events (profile activity feed). */
  async function inviteesForPerson(personId: string): Promise<InviteeForPerson[]> {
    return await $fetch<InviteeForPerson[]>('/api/v1/events/invitees-by-person', {
      query: { personId },
    })
  }
  /** Per-event invitee totals (total + confirmed) across an org — reporting page. */
  async function inviteeCountsByOrg(orgId: string): Promise<{ eventId: string; total: number; confirmed: number }[]> {
    return await $fetch('/api/v1/events/invitee-counts', { query: { orgId } })
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
  /** Replace ALL fee lines on ONE session (delete-then-insert; keyed by session_id). */
  async function replaceSessionFees(sessionId: string, items: FeeComponentCreate[]): Promise<FeeComponent[]> {
    return await $fetch<FeeComponent[]>(`/api/v1/sessions/${sessionId}/fees`, { method: 'POST', body: { items } })
  }
  /** Push a master session's shared fields onto every linked session (scoped to event+master). */
  async function propagateSessionMaster(masterId: string, eventId: string, patch: SessionPatch): Promise<void> {
    await $fetch('/api/v1/sessions/propagate', { method: 'POST', body: { masterId, eventId, patch } })
  }

  // ── Invitee writes ──
  /** Invite a person to an event. */
  async function addInvitee(eventId: string, body: {
    personId?: string | null; sessionId?: string | null; status?: string
    roles?: string[]; role?: string | null
  }): Promise<Invitee> {
    return await $fetch<Invitee>(`/api/v1/events/${eventId}/invitees`, { method: 'POST', body })
  }
  /** Update an invitee (RSVP status, roles, attendance, sign-out, sub-group). */
  async function updateInvitee(id: string, patch: {
    status?: string; roles?: string[]; role?: string | null; attended?: boolean
    signedOut?: boolean; subGroupId?: string | null
    respondedAt?: string | null; personId?: string | null
  }): Promise<Invitee> {
    return await $fetch<Invitee>(`/api/v1/invitees/${id}`, { method: 'PATCH', body: patch })
  }
  /** Remove an invitee. */
  async function removeInvitee(id: string): Promise<void> {
    await $fetch(`/api/v1/invitees/${id}`, { method: 'DELETE' })
  }

  // ── Registration writes ──
  /** Create a registration against an event. */
  async function createRegistration(eventId: string, body: Omit<RegistrationCreate, 'eventId'>): Promise<Registration> {
    return await $fetch<Registration>(`/api/v1/events/${eventId}/registrations`, { method: 'POST', body })
  }
  /** Update a registration. */
  async function updateRegistration(id: string, patch: RegistrationPatch): Promise<Registration> {
    return await $fetch<Registration>(`/api/v1/registrations/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a registration. */
  async function removeRegistration(id: string): Promise<void> {
    await $fetch(`/api/v1/registrations/${id}`, { method: 'DELETE' })
  }
  /** The session selections of a registration. */
  async function registrationSessions(registrationId: string): Promise<RegistrationSession[]> {
    return await $fetch<RegistrationSession[]>(`/api/v1/registrations/${registrationId}/sessions`)
  }
  /** Registration-session rows for a SET of sessions (per-session booking counts). */
  async function registrationSessionsBySessions(sessionIds: string[]): Promise<RegistrationSession[]> {
    if (!sessionIds.length) return []
    return await $fetch<RegistrationSession[]>('/api/v1/registration-sessions', {
      query: { sessionIds: sessionIds.join(',') },
    })
  }
  /** Add a session selection to a registration. */
  async function addRegistrationSession(registrationId: string, sessionId: string, status?: string): Promise<RegistrationSession> {
    return await $fetch<RegistrationSession>(`/api/v1/registrations/${registrationId}/sessions`, {
      method: 'POST', body: { sessionId, status },
    })
  }

  /** Ticket-order registrations for an event (registrations with a ticket_id + items). */
  async function ticketOrders(eventId: string): Promise<TicketOrder[]> {
    return await $fetch<TicketOrder[]>(`/api/v1/events/${eventId}/ticket-orders`)
  }

  // ── Recurrence series ──
  /** How many child occurrences a master currently has. */
  async function seriesCount(masterId: string): Promise<number> {
    const r = await $fetch<{ count: number }>(`/api/v1/events/${masterId}/series-count`)
    return r.count
  }
  /** The whole series (master + children) as { id, startAt, status } rows. */
  async function series(masterId: string): Promise<SeriesEvent[]> {
    return await $fetch<SeriesEvent[]>(`/api/v1/events/${masterId}/series`)
  }
  /** Regenerate a master's child occurrences from a list of { startAt, endAt }. */
  async function generateSeries(masterId: string, occurrences: { startAt: string; endAt: string | null }[]): Promise<number> {
    const r = await $fetch<{ count: number }>(`/api/v1/events/${masterId}/series`, { method: 'POST', body: { occurrences } })
    return r.count
  }
  /** Delete every child occurrence of a master. */
  async function deleteSeries(masterId: string): Promise<void> {
    await $fetch(`/api/v1/events/${masterId}/series`, { method: 'DELETE' })
  }
  /** Bulk-set the status of a set of events (org-scoped; series archive). */
  async function setEventsStatus(orgId: string, ids: string[], status: string): Promise<void> {
    await $fetch('/api/v1/events/set-status', { method: 'POST', body: { orgId, ids, status } })
  }

  // ── Fee components (event- and session-level fees) ──
  /** Fee lines for an event and/or a set of sessions. */
  async function feeComponents(opts: { eventId?: string; sessionIds?: string[] }): Promise<FeeComponent[]> {
    return await $fetch<FeeComponent[]>('/api/v1/events/fees', {
      query: { eventId: opts.eventId, sessionIds: opts.sessionIds?.join(',') },
    })
  }
  /** Create one fee line. */
  async function createFeeComponent(input: FeeComponentCreate): Promise<FeeComponent> {
    return await $fetch<FeeComponent>('/api/v1/fee-components', { method: 'POST', body: input })
  }
  /** Update a fee line. */
  async function updateFeeComponent(id: string, patch: FeeComponentPatch): Promise<FeeComponent> {
    return await $fetch<FeeComponent>(`/api/v1/fee-components/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a fee line. */
  async function removeFeeComponent(id: string): Promise<void> {
    await $fetch(`/api/v1/fee-components/${id}`, { method: 'DELETE' })
  }
  /** Replace ALL fee lines on an event (delete-then-insert). */
  async function replaceEventFees(eventId: string, items: FeeComponentCreate[]): Promise<FeeComponent[]> {
    return await $fetch<FeeComponent[]>(`/api/v1/events/${eventId}/fees`, { method: 'POST', body: { items } })
  }

  // ── Event notes ──
  async function notes(eventId: string): Promise<EventNote[]> {
    return await $fetch<EventNote[]>(`/api/v1/events/${eventId}/notes`)
  }
  async function createNote(eventId: string, body: Omit<EventNoteCreate, 'eventId'>): Promise<EventNote> {
    return await $fetch<EventNote>(`/api/v1/events/${eventId}/notes`, { method: 'POST', body })
  }
  async function updateNote(id: string, patch: EventNotePatch): Promise<EventNote> {
    return await $fetch<EventNote>(`/api/v1/event-notes/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeNote(id: string): Promise<void> {
    await $fetch(`/api/v1/event-notes/${id}`, { method: 'DELETE' })
  }

  // ── Event tasks ──
  async function tasks(eventId: string): Promise<EventTask[]> {
    return await $fetch<EventTask[]>(`/api/v1/events/${eventId}/tasks`)
  }
  async function createTask(eventId: string, body: Omit<EventTaskCreate, 'eventId'>): Promise<EventTask> {
    return await $fetch<EventTask>(`/api/v1/events/${eventId}/tasks`, { method: 'POST', body })
  }
  async function updateTask(id: string, patch: EventTaskPatch): Promise<EventTask> {
    return await $fetch<EventTask>(`/api/v1/event-tasks/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeTask(id: string): Promise<void> {
    await $fetch(`/api/v1/event-tasks/${id}`, { method: 'DELETE' })
  }

  // ── Event categories ──
  async function categories(orgId: string): Promise<EventCategory[]> {
    return await $fetch<EventCategory[]>('/api/v1/categories', { query: { orgId } })
  }
  async function createCategory(input: EventCategoryCreate): Promise<EventCategory> {
    return await $fetch<EventCategory>('/api/v1/categories', { method: 'POST', body: input })
  }
  async function updateCategory(id: string, patch: EventCategoryPatch): Promise<EventCategory> {
    return await $fetch<EventCategory>(`/api/v1/categories/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeCategory(id: string): Promise<void> {
    await $fetch(`/api/v1/categories/${id}`, { method: 'DELETE' })
  }

  // ── Ticket types ──
  async function tickets(eventId: string): Promise<TicketType[]> {
    return await $fetch<TicketType[]>(`/api/v1/events/${eventId}/tickets`)
  }
  async function createTicket(eventId: string, body: Omit<TicketTypeCreate, 'eventId'>): Promise<TicketType> {
    return await $fetch<TicketType>(`/api/v1/events/${eventId}/tickets`, { method: 'POST', body })
  }
  async function updateTicket(id: string, patch: TicketTypePatch): Promise<TicketType> {
    return await $fetch<TicketType>(`/api/v1/ticket-types/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeTicket(id: string): Promise<void> {
    await $fetch(`/api/v1/ticket-types/${id}`, { method: 'DELETE' })
  }

  // ── Connection groups (saved invitee sets) ──
  async function connectionGroups(orgId: string): Promise<ConnectionGroup[]> {
    return await $fetch<ConnectionGroup[]>('/api/v1/connection-groups', { query: { orgId } })
  }
  async function createConnectionGroup(orgId: string, name: string): Promise<ConnectionGroup> {
    return await $fetch<ConnectionGroup>('/api/v1/connection-groups', { method: 'POST', body: { orgId, name } })
  }
  async function connectionGroupEventIds(id: string): Promise<string[]> {
    return await $fetch<string[]>(`/api/v1/connection-groups/${id}/events`)
  }
  async function setConnectionGroupEvents(id: string, eventIds: string[]): Promise<void> {
    await $fetch(`/api/v1/connection-groups/${id}/events`, { method: 'PUT', body: { eventIds } })
  }
  async function removeConnectionGroup(id: string): Promise<void> {
    await $fetch(`/api/v1/connection-groups/${id}`, { method: 'DELETE' })
  }

  // ── Event disciplines (link table for <DisciplineLinker>) ──
  async function eventDisciplineIds(eventId: string): Promise<string[]> {
    return await $fetch<string[]>(`/api/v1/events/${eventId}/disciplines`)
  }
  async function setEventDisciplines(eventId: string, disciplineIds: string[]): Promise<void> {
    await $fetch(`/api/v1/events/${eventId}/disciplines`, { method: 'PUT', body: { disciplineIds } })
  }

  return {
    list, get, sessions, invitees, inviteesWithPerson, registrations, inviteesForPerson, inviteeCountsByOrg,
    ticketOrders,
    seriesCount, series, generateSeries, deleteSeries, setEventsStatus,
    create, update, remove,
    createSession, updateSession, removeSession, replaceSessionFees, propagateSessionMaster,
    addInvitee, updateInvitee, removeInvitee,
    createRegistration, updateRegistration, removeRegistration,
    registrationSessions, registrationSessionsBySessions, addRegistrationSession,
    feeComponents, createFeeComponent, updateFeeComponent, removeFeeComponent, replaceEventFees,
    notes, createNote, updateNote, removeNote,
    tasks, createTask, updateTask, removeTask,
    categories, createCategory, updateCategory, removeCategory,
    tickets, createTicket, updateTicket, removeTicket,
    connectionGroups, createConnectionGroup, connectionGroupEventIds,
    setConnectionGroupEvents, removeConnectionGroup,
    eventDisciplineIds, setEventDisciplines,
  }
}
