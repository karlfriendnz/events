// The repository: the ONLY code that knows how the club's email templates and
// (rich) communication topics are stored. Nitro routes call these; they never touch
// Drizzle directly. When the backend team's MySQL API replaces this, only this file
// changes — routes, composables and UI are untouched.
//
// This owns the WRITES for email_templates + communication_topics (the Settings →
// Communications editor). The thin, read-only topic list the FormDesigner uses still
// lives in `waitlists.ts` (listCommunicationTopics) — a separate, narrower surface;
// they read the same tables but never write the same rows.
//
// json handling: a topic's `channels` is a json column. mysql2 usually returns it
// parsed, but a driver/config can hand back the raw string — `asArray` normalises
// either (and never throws). On WRITE, json columns take the RAW JS value (Drizzle's
// json() double-encodes a pre-stringified value).
import { randomUUID } from 'node:crypto'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  EmailTemplate,
  CommTopic,
  CommTopicCreate,
  CommTopicPatch,
} from '../../../shared/contracts/communication'

// Coerce a json column into string[]: already an array → use it; a string → parse;
// anything else / a parse failure → [].
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[]
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? (parsed as string[]) : []
    } catch {
      return []
    }
  }
  return []
}

// Coerce a TINYINT/boolean column into a real boolean: the driver may return 1/0.
function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1'
}

function toEmailTemplate(r: typeof schema.emailTemplates.$inferSelect): EmailTemplate {
  return { id: r.id, orgId: r.orgId, key: r.key, subject: r.subject, body: r.body }
}

function toTopic(r: typeof schema.communicationTopics.$inferSelect): CommTopic {
  return {
    id: r.id,
    orgId: r.orgId ?? null,
    name: r.name,
    description: r.description ?? null,
    channels: asArray(r.channels),
    isCore: asBool(r.isCore),
    isActive: asBool(r.isActive),
    sortOrder: r.sortOrder,
  }
}

// ── Email templates (migration 259) ──

/** The club's saved wording for one email kind, or null when never saved. */
export async function getEmailTemplate(orgId: string, key: string): Promise<EmailTemplate | null> {
  const [r] = await db
    .select()
    .from(schema.emailTemplates)
    .where(and(eq(schema.emailTemplates.orgId, orgId), eq(schema.emailTemplates.key, key)))
    .limit(1)
  return r ? toEmailTemplate(r) : null
}

/** Upsert the club's wording for one kind (unique by org+key). Manual check-then
 *  update/insert so we don't depend on a DB unique index existing. */
export async function upsertEmailTemplate(
  orgId: string,
  key: string,
  subject: string,
  body: string,
): Promise<EmailTemplate> {
  const [existing] = await db
    .select({ id: schema.emailTemplates.id })
    .from(schema.emailTemplates)
    .where(and(eq(schema.emailTemplates.orgId, orgId), eq(schema.emailTemplates.key, key)))
    .limit(1)
  if (existing) {
    await db
      .update(schema.emailTemplates)
      .set({ subject, body, updatedAt: new Date() } as any)
      .where(eq(schema.emailTemplates.id, existing.id))
    return (await getEmailTemplate(orgId, key))!
  }
  const id = randomUUID()
  await db.insert(schema.emailTemplates).values({ id, orgId, key, subject, body } as any)
  return (await getEmailTemplate(orgId, key))!
}

// ── Communication topics (rich) ──

/** Every topic that applies to an org: the platform core topics (org_id null,
 *  is_core) followed by the club's own topics, each in sort order. The editor
 *  splits them by `isCore` (core = read-only). */
export async function listTopicsForOrg(orgId: string): Promise<CommTopic[]> {
  const core = await db
    .select()
    .from(schema.communicationTopics)
    .where(and(isNull(schema.communicationTopics.orgId), eq(schema.communicationTopics.isCore, true)))
    .orderBy(asc(schema.communicationTopics.sortOrder))
  const own = await db
    .select()
    .from(schema.communicationTopics)
    .where(eq(schema.communicationTopics.orgId, orgId))
    .orderBy(asc(schema.communicationTopics.sortOrder))
  return [...core.map(toTopic), ...own.map(toTopic)]
}

async function getTopic(id: string): Promise<CommTopic | null> {
  const [r] = await db
    .select()
    .from(schema.communicationTopics)
    .where(eq(schema.communicationTopics.id, id))
    .limit(1)
  return r ? toTopic(r) : null
}

/** Create one of the club's OWN topics (never core). sort_order appends after the
 *  club's existing topics. */
export async function createTopic(input: CommTopicCreate): Promise<CommTopic> {
  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.communicationTopics)
    .where(eq(schema.communicationTopics.orgId, input.orgId))
  const id = randomUUID()
  await db.insert(schema.communicationTopics).values({
    id,
    orgId: input.orgId,
    name: input.name,
    description: input.description ?? null,
    channels: input.channels ?? [],
    isCore: false,
    isActive: input.isActive ?? true,
    sortOrder: Number(n) || 0,
  } as any)
  return (await getTopic(id))!
}

/** Patch one of the club's own topics. Tenant-scoped in the WHERE (id AND org_id) —
 *  a core topic (org_id null) can never be updated through here. */
export async function updateTopic(id: string, patch: CommTopicPatch): Promise<CommTopic | null> {
  const set: Record<string, any> = {}
  if (patch.name !== undefined) set.name = patch.name
  if (patch.description !== undefined) set.description = patch.description
  if (patch.channels !== undefined) set.channels = patch.channels
  if (patch.isActive !== undefined) set.isActive = patch.isActive
  if (Object.keys(set).length) {
    set.updatedAt = new Date()
    await db
      .update(schema.communicationTopics)
      .set(set as any)
      .where(and(eq(schema.communicationTopics.id, id), eq(schema.communicationTopics.orgId, patch.orgId)))
  }
  return getTopic(id)
}

/** Delete one of the club's own topics. Tenant-scoped (id AND org_id) so a core
 *  topic is untouchable. */
export async function deleteTopic(id: string, orgId: string): Promise<void> {
  await db
    .delete(schema.communicationTopics)
    .where(and(eq(schema.communicationTopics.id, id), eq(schema.communicationTopics.orgId, orgId)))
}
