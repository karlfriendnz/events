// The repository: the ONLY code that knows how the prototype-review tables are
// stored (page_reviews, page_comments, page_signoffs). It turns DB rows into the
// contract shape and back. Nitro routes call these; they never touch Drizzle.
// page_reviewers is READ/seeded here too so <ReviewWidget> has one seam to call
// (admin.ts also lists reviewers for the master screens — both just read the table).
import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db, schema } from '../client'
import type {
  PageReview,
  PageComment,
  PageSignoff,
  PageReviewer,
  ReviewPageBundle,
  CreateCommentInput,
  PatchCommentInput,
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

// `context` is a json column holding the captured ReviewTarget. Kept as an
// opaque object: the capture module owns its shape (so it can be lifted into a
// browser extension), and a comment from a newer or older client must still load.
function toContext(v: unknown): Record<string, any> | null {
  if (v == null) return null
  if (typeof v === 'object') return v as Record<string, any>
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return p && typeof p === 'object' ? p : null } catch { return null }
  }
  return null
}

/** Attachment list, tolerant of a null column and of json handed back as text. */
function toAttachments(v: unknown): { url: string; name?: string | null }[] | null {
  const raw = typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return null } })() : v
  if (!Array.isArray(raw)) return null
  return raw.filter(a => a && typeof a.url === 'string').map(a => ({ url: a.url, name: a.name ?? null }))
}

/** A json string[] column (mentions), tolerant of null or text-encoded json. */
function toStringArray(v: unknown): string[] | null {
  const raw = typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return null } })() : v
  if (!Array.isArray(raw)) return null
  return raw.filter((s): s is string => typeof s === 'string')
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
    // mysql2 parses a json column into an object already; a legacy row may hold
    // a string, and TiDB has been known to hand json back as text.
    context: toContext(r.context),
    claudeStatus: r.claudeStatus ?? null,
    claudeNote: r.claudeNote ?? null,
    claudeAt: toIso(r.claudeAt),
    ready: Boolean(r.ready),
    readyAt: toIso(r.readyAt),
    attachments: toAttachments(r.attachments),
    seq: r.seq ?? null,
    mentions: toStringArray(r.mentions),
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

/**
 * The next permanent number for a page. Counts from the HIGHEST ever issued,
 * not from how many exist — deleting or resolving a comment must not free its
 * number for reuse, or two different things end up having been "pin 7".
 */
async function nextSeq(orgId: string, path: string): Promise<number> {
  const [row] = await db
    .select({ max: sql<number>`coalesce(max(${schema.pageComments.seq}), 0)` })
    .from(schema.pageComments)
    .where(and(eq(schema.pageComments.orgId, orgId), eq(schema.pageComments.path, path)))
  return Number(row?.max ?? 0) + 1
}

export async function createComment(input: CreateCommentInput): Promise<PageComment> {
  const id = randomUUID()
  await db.insert(schema.pageComments).values({
    id,
    seq: await nextSeq(input.orgId, input.path),
    mentions: input.mentions ?? null,
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
    context: input.context ?? null,
    // A reply inherits its parent's standing: it is a clarification ON approved
    // work, not a new suggestion needing its own approval.
    ready: input.ready ?? false,
    readyAt: input.ready ? new Date() : null,
    resolved: false,
  } as any)
  return (await getComment(id))!
}

/**
 * Partial update of one comment: resolve/reopen, edit the text, or record the
 * agent hand-back. Only the keys PRESENT in the input are written, so a resolve
 * can't blank a note and an edit can't quietly reopen something.
 *
 * Note `claudeStatus` deliberately does NOT resolve the comment. Claude marks
 * its work done and a robot icon appears; a human still signs it off. An agent
 * closing its own work would take the review out of the reviewer's hands, which
 * is the one thing this system exists to prevent.
 */
export async function patchComment(id: string, input: PatchCommentInput): Promise<PageComment | null> {
  const set: Record<string, any> = {}
  if (input.body !== undefined) set.body = input.body
  if (input.resolved !== undefined) {
    set.resolved = input.resolved
    set.resolvedBy = input.resolved ? input.resolvedById ?? null : null
    set.resolvedAt = input.resolved ? new Date() : null
  }
  if (input.claudeStatus !== undefined) {
    set.claudeStatus = input.claudeStatus
    set.claudeAt = input.claudeStatus ? new Date() : null
    // Clearing the status clears its note too — a note about work that is no
    // longer marked done is just a lie left lying around.
    if (!input.claudeStatus) set.claudeNote = null
  }
  if (input.claudeNote !== undefined) set.claudeNote = input.claudeNote
  if (input.ready !== undefined) {
    set.ready = input.ready
    set.readyAt = input.ready ? new Date() : null
  }
  if (input.attachments !== undefined) set.attachments = input.attachments
  if (input.mentions !== undefined) set.mentions = input.mentions
  // Re-anchoring: position and element description move together.
  if (input.x !== undefined) set.x = input.x
  if (input.y !== undefined) set.y = input.y
  if (input.anchorSelector !== undefined) set.anchorSelector = input.anchorSelector
  if (input.context !== undefined) set.context = input.context
  if (Object.keys(set).length) {
    await db.update(schema.pageComments).set(set).where(eq(schema.pageComments.id, id))
  }
  // Blocking on a question? Post it as a REPLY as well as a status.
  //
  // A note tucked into a chip is a dead end — there is nowhere to answer it. As
  // a reply it lands in the thread, Karl answers underneath, and the whole
  // exchange sits against the comment it is about (and rides along in the next
  // task brief, which already carries replies under their parent).
  if (input.claudeStatus === 'needs_info' && input.claudeNote?.trim()) {
    await addAgentReply(id, input.claudeNote.trim())
  }
  return getComment(id)
}

/**
 * A reply authored by the agent. Idempotent on the exact text so re-marking the
 * same question doesn't stack duplicates in the thread.
 */
export async function addAgentReply(parentId: string, body: string): Promise<void> {
  const parent = await getComment(parentId)
  if (!parent) return
  const existing = await db.select().from(schema.pageComments)
    .where(and(eq(schema.pageComments.parentId, parentId), eq(schema.pageComments.body, body)))
    .limit(1)
  if (existing.length) return
  await db.insert(schema.pageComments).values({
    id: randomUUID(),
    orgId: parent.orgId,
    path: parent.path,
    parentId,
    body,
    authorName: AGENT_AUTHOR,
    authorId: null,
    reviewerId: null,
    x: null, y: null,
    // A reply carries its parent's standing — it clarifies approved work rather
    // than proposing something new.
    ready: parent.ready,
    readyAt: parent.ready ? new Date() : null,
    resolved: false,
  } as any)
}

/** Author name on agent-written replies, so the panel can style them. */
export const AGENT_AUTHOR = 'Claude'

/**
 * Every unresolved comment ACROSS THE ORG that names this reviewer.
 *
 * Deliberately not page-scoped: the panel shows the page you're standing on, so
 * without a cross-page read an @mention would only ever be seen by someone who
 * happened to wander onto the right screen — which is precisely the problem
 * mentions exist to solve.
 *
 * Filtering happens in JS rather than SQL because `mentions` is a json array and
 * the predicate differs between MySQL and Postgres; the row count here is small
 * (one org's open review comments) and correctness across both beats a clever query.
 */
export async function listMentionsFor(orgId: string, reviewerId: string): Promise<PageComment[]> {
  const rows = await db.select().from(schema.pageComments)
    .where(and(eq(schema.pageComments.orgId, orgId), eq(schema.pageComments.resolved, false)))
    .orderBy(asc(schema.pageComments.createdAt))
  return rows.map(toComment).filter(c => c.mentions?.includes(reviewerId))
}

/**
 * Stamp comments as handed over. Only touches ones with NO status yet: an item
 * already marked done (or asking a question) must not be dragged back to
 * "queued" just because it rode along in a later export.
 */
export async function markCommentsQueued(ids: string[]): Promise<void> {
  if (!ids.length) return
  await db.update(schema.pageComments)
    .set({ claudeStatus: 'queued', claudeAt: new Date() })
    .where(and(inArray(schema.pageComments.id, ids), isNull(schema.pageComments.claudeStatus)))
}

/**
 * Every UNRESOLVED comment in the org, newest page first — the raw material for
 * the exported task brief. Replies come too (parentId is set): a reply often
 * carries the clarification that makes the parent actionable.
 */
export async function listOpenComments(orgId: string): Promise<PageComment[]> {
  const rows = await db.select().from(schema.pageComments)
    .where(and(eq(schema.pageComments.orgId, orgId), eq(schema.pageComments.resolved, false)))
    .orderBy(asc(schema.pageComments.path), asc(schema.pageComments.createdAt))
  return rows.map(toComment)
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
