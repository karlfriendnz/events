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
})
export type CreateCommentInput = z.infer<typeof createCommentInputSchema>

export const setCommentResolvedInputSchema = z.object({
  resolved: z.boolean(),
  resolvedById: z.string().nullable().optional(),
})

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
