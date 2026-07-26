// Contract for the in-app prototype REVIEW system (page_reviews / page_comments /
// page_signoffs) that backs <ReviewWidget>, useDeveloperGate and pages/dev/review.
// The named reviewers themselves (page_reviewers) live in the admin contract —
// reused here rather than redefined so there is one PageReviewer shape.
//
// Output is camelCase; the widget maps back to the snake_case shape its template
// reads (createdAt → created_at etc.) at the composable boundary.
import { z } from 'zod'
import { pageReviewerSchema, pageReviewerListSchema } from './admin'
export { pageReviewerSchema, pageReviewerListSchema }
export type { PageReviewer } from './admin'

export const REVIEW_STAGES = ['draft', 'in_review', 'approved'] as const

export const pageReviewSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  path: z.string(),
  stage: z.string(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
})
export type PageReview = z.infer<typeof pageReviewSchema>

export const pageCommentSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  path: z.string(),
  body: z.string(),
  authorId: z.string().nullable(),
  authorName: z.string().nullable(),
  // x/y are decimal columns — coerced to real numbers in the repo (mysql2 hands
  // decimals back as strings, and the widget does pixel arithmetic on them).
  x: z.number().nullable(),
  y: z.number().nullable(),
  resolved: z.boolean(),
  resolvedBy: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  reviewerId: z.string().nullable(),
  parentId: z.string().nullable(),
  anchorSelector: z.string().nullable(),
  // The captured ReviewTarget (utils/reviewTarget.ts). Held as a passthrough
  // object rather than a mirrored zod shape ON PURPOSE: the capture module is
  // deliberately standalone so it can be lifted into a browser extension, and
  // re-declaring its fields here would make it two things to keep in step. A
  // comment must survive a capture from a newer/older client either way.
  context: z.record(z.any()).nullable(),
  claudeStatus: z.string().nullable(),
  claudeNote: z.string().nullable(),
  claudeAt: z.string().nullable(),
  /** Approved by the builder as real work. Only ready comments reach an agent. */
  ready: z.boolean(),
  readyAt: z.string().nullable(),
  /** Images dropped on the comment — screenshots, mock-ups, references. */
  attachments: z.array(z.object({ url: z.string(), name: z.string().nullable().optional() })).nullable(),
  /**
   * The comment's PERMANENT number on its page. Assigned once and never reused,
   * so resolving one comment can't renumber the rest — "pin 7" means the same
   * thing tomorrow. Nullable only for rows created before migration 0020.
   */
  seq: z.number().nullable(),
  /** page_reviewers ids this comment addresses (@kate). */
  mentions: z.array(z.string()).nullable(),
  createdAt: z.string().nullable(),
})
export type PageComment = z.infer<typeof pageCommentSchema>
export const pageCommentListSchema = z.array(pageCommentSchema)

export const pageSignoffSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  path: z.string(),
  reviewerId: z.string(),
  signedByUserId: z.string().nullable(),
  note: z.string().nullable(),
  signedAt: z.string().nullable(),
})
export type PageSignoff = z.infer<typeof pageSignoffSchema>
export const pageSignoffListSchema = z.array(pageSignoffSchema)

// The whole per-page load in one shot — what <ReviewWidget>.load() needs.
export const reviewPageBundleSchema = z.object({
  review: pageReviewSchema.nullable(),
  comments: pageCommentListSchema,
  signoffs: pageSignoffListSchema,
})
export type ReviewPageBundle = z.infer<typeof reviewPageBundleSchema>

export const pageStageSchema = z.object({ stage: z.string().nullable() })

// ── Inputs ───────────────────────────────────────────────────────────────────
export const setStageInputSchema = z.object({
  orgId: z.string().min(1),
  path: z.string().min(1),
  stage: z.enum(REVIEW_STAGES),
  approvedById: z.string().nullable().optional(),
})

export const createCommentInputSchema = z.object({
  orgId: z.string().min(1),
  path: z.string().min(1),
  body: z.string().min(1),
  authorId: z.string().nullable().optional(),
  authorName: z.string().nullable().optional(),
  reviewerId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  anchorSelector: z.string().nullable().optional(),
  mentions: z.array(z.string()).nullable().optional(),
  context: z.record(z.any()).nullable().optional(),
  /**
   * Set by the client when the author IS the builder — his own comments are
   * work by definition, so the triage gate never costs him a second click.
   * Everyone else's default to false and wait for his approval.
   */
  ready: z.boolean().optional(),
})
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>

/**
 * ONE partial patch for a comment. Resolve/reopen, fix a typo in the body, or
 * record that Claude actioned it — every field optional, only what is sent is
 * written. Three near-identical routes would have been three places to keep the
 * "what may a client change" rule in step.
 */
export const patchCommentInputSchema = z.object({
  resolved: z.boolean().optional(),
  resolvedById: z.string().nullable().optional(),
  /** Edited comment text. */
  body: z.string().min(1).optional(),
  /**
   * Agent hand-back; null clears it back to untouched.
   *  - 'queued'     → included in a task brief and handed over; not started.
   *                   Stamped by the export itself, so the panel shows what is
   *                   in flight rather than looking identical to untouched work.
   *  - 'done'       → actioned, awaiting a human sign-off.
   *  - 'needs_info' → could not be placed or understood; `claudeNote` holds the
   *    question. This exists so the honest answer to an ambiguous note is a
   *    QUESTION rather than a guessed change to the wrong element.
   */
  claudeStatus: z.enum(['queued', 'done', 'needs_info']).nullable().optional(),
  claudeNote: z.string().nullable().optional(),
  /** Builder approving (or un-approving) a suggestion as real work. */
  ready: z.boolean().optional(),
  /** Whole replacement of the attachment list (add or remove an image). */
  attachments: z.array(z.object({ url: z.string(), name: z.string().nullable().optional() })).nullable().optional(),
  /** Re-derived from the body whenever the text is edited. */
  mentions: z.array(z.string()).nullable().optional(),
  /**
   * RE-ANCHORING an existing pin — the capture guessed the wrong element, or
   * the comment was left before capture existed. Sent as a set (position AND
   * the element description together), because a pin whose coordinates say one
   * thing and whose context says another is worse than either alone.
   */
  x: z.number().nullable().optional(),
  y: z.number().nullable().optional(),
  anchorSelector: z.string().nullable().optional(),
  context: z.record(z.any()).nullable().optional(),
})
export type PatchCommentInput = z.infer<typeof patchCommentInputSchema>

/** @deprecated kept so an older client's resolve payload still parses. */
export const setCommentResolvedInputSchema = patchCommentInputSchema

// ── Task brief (the "hand these to Claude" export) ───────────────────────────
export const buildBriefInputSchema = z.object({
  orgId: z.string().min(1),
  /** Limit the brief to one page key; omitted = every open comment in the org. */
  path: z.string().nullable().optional(),
  /**
   * Hand over just these comments. Takes precedence over `path` — an explicit
   * pick is a stronger statement of intent than the page filter it was made on.
   * Omitted/empty = fall back to the path scope.
   */
  ids: z.array(z.string()).nullable().optional(),
})
export const briefResultSchema = z.object({
  file: z.string(),
  taskCount: z.number(),
  pageCount: z.number(),
  markdown: z.string(),
})
export type BriefResult = z.infer<typeof briefResultSchema>

export const createSignoffInputSchema = z.object({
  orgId: z.string().min(1),
  path: z.string().min(1),
  reviewerId: z.string().min(1),
  signedByUserId: z.string().nullable().optional(),
})

const reviewerSeedItemSchema = z.object({
  name: z.string(),
  role: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int(),
})
export const ensureReviewersInputSchema = z.object({
  orgId: z.string().min(1),
  defaults: z.array(reviewerSeedItemSchema),
})
export const createReviewerInputSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(1),
  role: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int(),
})

export const okSchema = z.object({ ok: z.boolean() })
export const approvedPathsSchema = z.array(z.string())

// The org-wide sign-off REPORT (pages × reviewers) — pages/dev/review.
export const reviewReportSchema = z.object({
  reviewers: pageReviewerListSchema,
  reviews: z.array(z.object({ path: z.string(), stage: z.string() })),
  comments: z.array(z.object({ path: z.string(), resolved: z.boolean() })),
  signoffs: z.array(z.object({ path: z.string(), reviewerId: z.string(), signedAt: z.string().nullable() })),
})
export type ReviewReport = z.infer<typeof reviewReportSchema>
