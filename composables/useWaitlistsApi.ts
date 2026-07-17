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
  /** The club's email templates. */
  async function emailTemplates(orgId: string): Promise<EmailTemplate[]> {
    return await $fetch<EmailTemplate[]>('/api/v1/communications', {
      query: { orgId, resource: 'templates' },
    })
  }
  /** The club's named calendars. */
  async function calendars(orgId: string): Promise<Calendar[]> {
    return await $fetch<Calendar[]>('/api/v1/calendars', { query: { orgId } })
  }
  return {
    waitlists,
    createWaitlist,
    updateWaitlist,
    removeWaitlist,
    entries,
    communications,
    topics,
    emailTemplates,
    calendars,
  }
}
