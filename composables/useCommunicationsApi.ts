// The client side of the seam for the communications editor (Settings →
// Communications): the club's email templates and its communication topics.
// Components call this — never useDb(), never Supabase, never $fetch to a raw table.
// Returns fully-typed domain objects (the shared contract).
//
// This is a SEPARATE, richer surface from the read-only sent-communications log and
// thin topic list served by /api/v1/communications (which the FormDesigner uses).
import type {
  EmailTemplate,
  CommTopic,
  CommTopicCreate,
  CommTopicPatch,
} from '../shared/contracts/communication'
// The sent-message log's Communication shape lives in the waitlist contract (its
// historical home, shared with the /api/v1/communications log route).
import type { Communication } from '../shared/contracts/waitlist'

export function useCommunicationsApi() {
  // ── Email templates ──
  /** The club's saved wording for one email kind, or null when never saved. */
  async function getEmailTemplate(orgId: string, key: string): Promise<EmailTemplate | null> {
    return await $fetch<EmailTemplate | null>('/api/v1/email-templates', { query: { orgId, key } })
  }
  /** Upsert the club's wording for one kind (unique by org + key). */
  async function upsertEmailTemplate(input: { orgId: string; key: string; subject: string; body: string }): Promise<EmailTemplate> {
    return await $fetch<EmailTemplate>('/api/v1/email-templates', { method: 'POST', body: input })
  }

  // ── Communication topics (rich) ──
  /** The platform core topics + the club's own topics, in sort order. */
  async function listTopics(orgId: string): Promise<CommTopic[]> {
    return await $fetch<CommTopic[]>('/api/v1/communication-topics', { query: { orgId } })
  }
  /** Create one of the club's own topics (never core). */
  async function createTopic(input: CommTopicCreate): Promise<CommTopic> {
    return await $fetch<CommTopic>('/api/v1/communication-topics', { method: 'POST', body: input })
  }
  /** Patch one of the club's own topics. */
  async function updateTopic(id: string, patch: CommTopicPatch): Promise<CommTopic> {
    return await $fetch<CommTopic>(`/api/v1/communication-topics/${id}`, { method: 'PATCH', body: patch })
  }
  /** Delete one of the club's own topics (orgId tenant-scopes the delete). */
  async function removeTopic(id: string, orgId: string): Promise<void> {
    await $fetch(`/api/v1/communication-topics/${id}`, { method: 'DELETE', query: { orgId } })
  }

  // ── Sent-message log ──
  /** Communications sent about a SET of events (a profile's per-event comms), newest
   *  first. */
  async function byEvents(eventIds: string[]): Promise<Communication[]> {
    if (!eventIds.length) return []
    return await $fetch<Communication[]>('/api/v1/communications', { query: { eventIds: eventIds.join(',') } })
  }

  return { getEmailTemplate, upsertEmailTemplate, listTopics, createTopic, updateTopic, removeTopic, byEvents }
}
