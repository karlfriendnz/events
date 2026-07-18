// Communications-domain contracts: the club's email templates and the richer comms
// topics the Settings → Communications screen edits. This is a SEPARATE, richer
// surface from the thin `communicationTopicSchema` in `waitlist.ts` (which the
// FormDesigner uses to list subscribable subjects) — this one carries the columns
// the topic editor needs (description / isCore / isActive / sortOrder) and the
// create/patch shapes for writing.
import { z } from 'zod'

// ── Email templates (migration 259) ──
// One row per org, keyed by kind ('event_invitation', reminders, …). The club's
// default wording every event seeds from.
export const emailTemplateSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  key: z.string(),
  subject: z.string(),
  body: z.string(),
})
export type EmailTemplate = z.infer<typeof emailTemplateSchema>

// The template read route returns null when a key hasn't been saved yet.
export const emailTemplateOrNullSchema = emailTemplateSchema.nullable()

// Upsert-by-(org, key): the write always carries org + key + the wording.
export const emailTemplateUpsertSchema = z.object({
  orgId: z.string(),
  key: z.string().min(1),
  subject: z.string(),
  body: z.string(),
})
export type EmailTemplateUpsert = z.infer<typeof emailTemplateUpsertSchema>

// ── Communication topics (rich) ──
// A comms category a person can subscribe to. Core topics are platform-wide
// (`orgId` null, `isCore` true) and read-only to a club; the club adds its own.
export const commTopicSchema = z.object({
  id: z.string(),
  orgId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  // json array → plain string[] at the boundary.
  channels: z.array(z.string()),
  isCore: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
})
export type CommTopic = z.infer<typeof commTopicSchema>

export const commTopicListSchema = z.array(commTopicSchema)

// A club creates only its own (non-core) topics.
export const commTopicCreateSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  channels: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})
export type CommTopicCreate = z.infer<typeof commTopicCreateSchema>

// Every field optional — a partial update. orgId is carried for tenant-scoping the
// WHERE (never trust the id alone); a core topic (orgId null) can never be hit.
export const commTopicPatchSchema = z.object({
  orgId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  channels: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})
export type CommTopicPatch = z.infer<typeof commTopicPatchSchema>

// A staff `notifications` row (booking approved/declined, etc.). The write returns just
// the id so the page can fire the email trigger; `payload` is passthrough json.
export const notificationCreateSchema = z.object({
  orgId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  payload: z.any().optional(),
})
export type NotificationCreate = z.infer<typeof notificationCreateSchema>
