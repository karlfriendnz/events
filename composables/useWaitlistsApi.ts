// The client side of the seam for waitlists, communications and calendars.
// Components call this — never useDb(), never Supabase, never $fetch to a raw table.
// It returns fully-typed domain objects (the shared contract), so a component has no
// idea whether the data came from MySQL today or the backend team's API tomorrow.
import type {
  Waitlist,
  WaitlistCreate,
  WaitlistPatch,
  WaitlistEntry,
  Communication,
  CommunicationTopic,
  EmailTemplate,
  Calendar,
  CalendarCreate,
  CalendarPatch,
} from '../shared/contracts/waitlist'

export function useWaitlistsApi() {
  /** Every waitlist an org has. */
  async function waitlists(orgId: string): Promise<Waitlist[]> {
    return await $fetch<Waitlist[]>('/api/v1/waitlists', { query: { orgId } })
  }
  async function createWaitlist(input: WaitlistCreate): Promise<Waitlist> {
    return await $fetch<Waitlist>('/api/v1/waitlists', { method: 'POST', body: input })
  }
  async function updateWaitlist(id: string, patch: WaitlistPatch): Promise<Waitlist> {
    return await $fetch<Waitlist>(`/api/v1/waitlists/${id}`, { method: 'PATCH', body: patch })
  }
  async function removeWaitlist(id: string): Promise<void> {
    await $fetch(`/api/v1/waitlists/${id}`, { method: 'DELETE' })
  }
  /** The people waiting in one queue, in position order. */
  async function entries(waitlistId: string): Promise<WaitlistEntry[]> {
    return await $fetch<WaitlistEntry[]>('/api/v1/waitlists', { query: { waitlistId } })
  }
  /** An org's sent communications. */
  async function communications(orgId: string): Promise<Communication[]> {
    return await $fetch<Communication[]>('/api/v1/communications', { query: { orgId } })
  }
  /** The comms topics (categories) an org offers. */
  async function topics(orgId: string): Promise<CommunicationTopic[]> {
    return await $fetch<CommunicationTopic[]>('/api/v1/communications', {
      query: { orgId, resource: 'topics' },
    })
  }
  /** The ACTIVE comms topics for a form/preview: the platform core topics merged with
   *  the org's own, inactive ones dropped. */
  async function activeTopics(orgId: string): Promise<CommunicationTopic[]> {
    return await $fetch<CommunicationTopic[]>('/api/v1/communications', {
      query: { orgId, resource: 'active-topics' },
    })
  }
  /** The club's email templates. */
  async function emailTemplates(orgId: string): Promise<EmailTemplate[]> {
    return await $fetch<EmailTemplate[]>('/api/v1/communications', {
      query: { orgId, resource: 'templates' },
    })
  }
  /** The club's named calendars, each with its linked category ids. */
  async function calendars(orgId: string): Promise<Calendar[]> {
    return await $fetch<Calendar[]>('/api/v1/calendars', { query: { orgId } })
  }
  /** Create a named calendar (optionally seeding its category links). */
  async function createCalendar(input: CalendarCreate): Promise<Calendar> {
    return await $fetch<Calendar>('/api/v1/calendars', { method: 'POST', body: input })
  }
  /** Update a calendar's name / colour / icon / pin / settings. */
  async function updateCalendar(id: string, patch: CalendarPatch): Promise<Calendar> {
    return await $fetch<Calendar>(`/api/v1/calendars/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete a calendar (and its category links). orgId tenant-scopes the delete. */
  async function removeCalendar(orgId: string, id: string): Promise<void> {
    await $fetch(`/api/v1/calendars/${id}`, { method: 'DELETE', query: { orgId } })
  }
  /** Replace the set of categories a calendar shows. Returns the new category ids. */
  async function setCalendarCategories(
    orgId: string,
    calendarId: string,
    categoryIds: string[],
  ): Promise<string[]> {
    const res = await $fetch<{ categoryIds: string[] }>('/api/v1/calendar-categories', {
      method: 'POST',
      body: { orgId, calendarId, categoryIds },
    })
    return res.categoryIds
  }
  return {
    waitlists,
    createWaitlist,
    updateWaitlist,
    removeWaitlist,
    entries,
    communications,
    topics,
    activeTopics,
    emailTemplates,
    calendars,
    createCalendar,
    updateCalendar,
    removeCalendar,
    setCalendarCategories,
  }
}
