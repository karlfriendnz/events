// The repository: the ONLY code that knows how the prototype-review tables are
// stored (page_reviews, page_comments, page_signoffs). It turns DB rows into the
// contract shape and back. Nitro routes call these; they never touch Drizzle.
// page_reviewers is READ/seeded here too so <ReviewWidget> has one seam to call
// (admin.ts also lists reviewers for the master screens — both just read the table).
import { randomUUID } from 'node:crypto'
import { and, asc, eq, or } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  PageReview,
  PageComment,
  PageSignoff,
  PageReviewer,
  ReviewPageBundle,
  CreateCommentInput,
} from '../../../shared/contracts/review'

// created_at/updated_at are TIMESTAMPs — a Date from the driver, or an ISO string.
function toIso(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  return String(v)
}
// x/y are DECIMAL columns — mysql2 returns them as strings; the widget does pixel
// arithmetic, so coerce to a real number (null stays null).
function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toReview(r: typeof schema.pageReviews.$inferSelect): PageReview {
  return {
    id: r.id,
    orgId: r.orgId,
    path: r.path,
    stage: r.stage,
    approvedBy: r.approvedBy ?? null,
    approvedAt: toIso(r.approvedAt),
    updatedAt: toIso(r.updatedAt),
    createdAt: toIso(r.createdAt),
  }
}
function toComment(r: typeof schema.pageComments.$inferSelect): PageComment {
  return {
    id: r.id,
    orgId: r.orgId,
    path: r.path,
    body: r.body,
    authorId: r.authorId ?? null,
    authorName: r.authorName ?? null,
    x: toNum(r.x),
    y: toNum(r.y),
    resolved: Boolean(r.resolved),
    resolvedBy: r.resolvedBy ?? null,
    resolvedAt: toIso(r.resolvedAt),
    reviewerId: r.reviewerId ?? null,
    parentId: r.parentId ?? null,
    anchorSelector: r.anchorSelector ?? null,
    createdAt: toIso(r.createdAt),
  }
}
function toSignoff(r: typeof schema.pageSignoffs.$inferSelect): PageSignoff {
  return {
    id: r.id,
    orgId: r.orgId,
    path: r.path,
    reviewerId: r.reviewerId,
    signedByUserId: r.signedByUserId ?? null,
    note: r.note ?? null,
    signedAt: toIso(r.signedAt),
  }
}
function toReviewer(r: typeof schema.pageReviewers.$inferSelect): PageReviewer {
  return {
    id: r.id,
    orgId: r.orgId,
    name: r.name,
    role: r.role ?? null,
    color: r.color ?? null,
    sortOrder: r.sortOrder,
  }
}

// ── Per-page load ──────────────────────────────────────────────────────────────
async function getReview(orgId: string, path: string): Promise<PageReview | null> {
  const [r] = await db.select().from(schema.pageReviews)
    .where(and(eq(schema.pageReviews.orgId, orgId), eq(schema.pageReviews.path, path)))
    .limit(1)
  return r ? toReview(r) : null
}

export async function getPageBundle(orgId: string, path: string): Promise<ReviewPageBundle> {
  const [review, comments, signoffs] = await Promise.all([
    getReview(orgId, path),
    db.select().from(schema.pageComments)
      .where(and(eq(schema.pageComments.orgId, orgId), eq(schema.pageComments.path, path)))
      .orderBy(asc(schema.pageComments.createdAt)),
    db.select().from(schema.pageSignoffs)
      .where(and(eq(schema.pageSignoffs.orgId, orgId), eq(schema.pageSignoffs.path, path))),
  ])
  return { review, comments: comments.map(toComment), signoffs: signoffs.map(toSignoff) }
}

export async function getStage(orgId: string, path: string): Promise<string | null> {
  const r = await getReview(orgId, path)
  return r?.stage ?? null
}

/** The org's APPROVED page paths (developer-gate navigable list). */
export async function listApprovedPaths(orgId: string): Promise<string[]> {
  const rows = await db.select({ path: schema.pageReviews.path }).from(schema.pageReviews)
    .where(and(eq(schema.pageReviews.orgId, orgId), eq(schema.pageReviews.stage, 'approved')))
  return rows.map(r => r.path)
}

/** The org-wide sign-off report data (pages × reviewers) for pages/dev/review. */
export async function getReviewReport(orgId: string): Promise<{
  reviewers: PageReviewer[]
  reviews: { path: string; stage: string }[]
  comments: { path: string; resolved: boolean }[]
  signoffs: { path: string; reviewerId: string; signedAt: string | null }[]
}> {
  const [reviewers, reviews, comments, signoffs] = await Promise.all([
    listReviewers(orgId),
    db.select({ path: schema.pageReviews.path, stage: schema.pageReviews.stage })
      .from(schema.pageReviews).where(eq(schema.pageReviews.orgId, orgId)),
    db.select({ path: schema.pageComments.path, resolved: schema.pageComments.resolved })
      .from(schema.pageComments).where(eq(schema.pageComments.orgId, orgId)),
    db.select({ path: schema.pageSignoffs.path, reviewerId: schema.pageSignoffs.reviewerId, signedAt: schema.pageSignoffs.signedAt })
      .from(schema.pageSignoffs).where(eq(schema.pageSignoffs.orgId, orgId)),
  ])
  return {
    reviewers,
    reviews: reviews.map(r => ({ path: r.path, stage: r.stage })),
    comments: comments.map(c => ({ path: c.path, resolved: Boolean(c.resolved) })),
    signoffs: signoffs.map(s => ({ path: s.path, reviewerId: s.reviewerId, signedAt: toIso(s.signedAt) })),
  }
}

// ── Stage (upsert per org+path) ─────────────────────────────────────────────────
export async function setStage(
  orgId: string, path: string, stage: string, approvedById: string | null,
): Promise<PageReview> {
  const approving = stage === 'approved'
  const set: Record<string, any> = {
    stage,
    updatedAt: new Date(),
    approvedBy: approving ? approvedById ?? null : null,
    approvedAt: approving ? new Date() : null,
  }
  const existing = await getReview(orgId, path)
  if (existing) {
    await db.update(schema.pageReviews).set(set).where(eq(schema.pageReviews.id, existing.id))
  } else {
    await db.insert(schema.pageReviews).values({ id: randomUUID(), orgId, path, ...set } as any)
  }
  return (await getReview(orgId, path))!
}

// ── Comments ─────────────────────────────────────────────────────────────────
async function getComment(id: string): Promise<PageComment | null> {
  const [r] = await db.select().from(schema.pageComments).where(eq(schema.pageComments.id, id)).limit(1)
  return r ? toComment(r) : null
}

export async function createComment(input: CreateCommentInput): Promise<PageComment> {
  const id = randomUUID()
  await db.insert(schema.pageComments).values({
    id,
    orgId: input.orgId,
    path: input.path,
    body: input.body,
    authorId: input.authorId ?? null,
    authorName: input.authorName ?? null,
    reviewerId: input.reviewerId ?? null,
    parentId: input.parentId ?? null,
    x: input.x ?? null,
    y: input.y ?? null,
    anchorSelector: input.anchorSelector ?? null,
    resolved: false,
  } as any)
  return (await getComment(id))!
}

export async function setCommentResolved(
  id: string, resolved: boolean, resolvedById: string | null,
): Promise<PageComment | null> {
  await db.update(schema.pageComments).set({
    resolved,
    resolvedBy: resolved ? resolvedById ?? null : null,
    resolvedAt: resolved ? new Date() : null,
  }).where(eq(schema.pageComments.id, id))
  return getComment(id)
}

/** Hard-delete a comment AND any replies pinned under it (parent_id = id). */
export async function deleteCommentCascade(id: string): Promise<void> {
  await db.delete(schema.pageComments)
    .where(or(eq(schema.pageComments.id, id), eq(schema.pageComments.parentId, id)))
}

// ── Sign-offs ──────────────────────────────────────────────────────────────────
export async function createSignoff(input: {
  orgId: string; path: string; reviewerId: string; signedByUserId: string | null
}): Promise<PageSignoff> {
  const id = randomUUID()
  await db.insert(schema.pageSignoffs).values({
    id,
    orgId: input.orgId,
    path: input.path,
    reviewerId: input.reviewerId,
    signedByUserId: input.signedByUserId ?? null,
  } as any)
  const [r] = await db.select().from(schema.pageSignoffs).where(eq(schema.pageSignoffs.id, id)).limit(1)
  return toSignoff(r)
}

export async function deleteSignoff(id: string): Promise<void> {
  await db.delete(schema.pageSignoffs).where(eq(schema.pageSignoffs.id, id))
}

// ── Reviewers ──────────────────────────────────────────────────────────────────
export async function listReviewers(orgId: string): Promise<PageReviewer[]> {
  const rows = await db.select().from(schema.pageReviewers)
    .where(eq(schema.pageReviewers.orgId, orgId))
    .orderBy(asc(schema.pageReviewers.sortOrder), asc(schema.pageReviewers.name))
  return rows.map(toReviewer)
}

export async function createReviewer(input: {
  orgId: string; name: string; role: string | null; color: string | null; sortOrder: number
}): Promise<PageReviewer> {
  const id = randomUUID()
  await db.insert(schema.pageReviewers).values({
    id,
    orgId: input.orgId,
    name: input.name,
    role: input.role ?? null,
    color: input.color ?? null,
    sortOrder: input.sortOrder,
  } as any)
  const [r] = await db.select().from(schema.pageReviewers).where(eq(schema.pageReviewers.id, id)).limit(1)
  return toReviewer(r)
}

/**
 * Seed the DEFAULT reviewer set for an org the first time the widget opens —
 * only when it has none. Returns the resolved list either way (idempotent).
 */
export async function ensureReviewers(
  orgId: string,
  defaults: { name: string; role?: string | null; color?: string | null; sortOrder: number }[],
): Promise<PageReviewer[]> {
  const existing = await listReviewers(orgId)
  if (existing.length) return existing
  if (defaults.length) {
    await db.insert(schema.pageReviewers).values(
      defaults.map(d => ({
        id: randomUUID(),
        orgId,
        name: d.name,
        role: d.role ?? null,
        color: d.color ?? null,
        sortOrder: d.sortOrder,
      })) as any,
    )
  }
  return listReviewers(orgId)
}
