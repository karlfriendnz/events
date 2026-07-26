// The client side of the seam for the prototype REVIEW system — <ReviewWidget>,
// useDeveloperGate and pages/dev/review call these instead of useDb().
//
// The routes return camelCase (parse-on-output), but the widget's template is
// heavily snake_case (created_at / parent_id / anchor_selector / signed_at …), so
// this composable maps back to the app's native snake_case ROW shape at the
// boundary. Consumers keep their existing shapes; only data access changed.
import type {
  PageReview, PageComment, PageSignoff, PageReviewer, ReviewReport, BriefResult,
} from '../shared/contracts/review'

// camelCase (seam) → snake_case (app row) mappers.
function toReviewRow(r: PageReview | null): any {
  if (!r) return null
  return {
    id: r.id, org_id: r.orgId, path: r.path, stage: r.stage,
    approved_by: r.approvedBy, approved_at: r.approvedAt,
    updated_at: r.updatedAt, created_at: r.createdAt,
  }
}
function toCommentRow(c: PageComment): any {
  return {
    id: c.id, org_id: c.orgId, path: c.path, body: c.body,
    author_id: c.authorId, author_name: c.authorName,
    x: c.x, y: c.y, resolved: c.resolved,
    resolved_by: c.resolvedBy, resolved_at: c.resolvedAt,
    reviewer_id: c.reviewerId, parent_id: c.parentId,
    anchor_selector: c.anchorSelector, created_at: c.createdAt,
    context: c.context,
    claude_status: c.claudeStatus, claude_note: c.claudeNote, claude_at: c.claudeAt,
    ready: c.ready, ready_at: c.readyAt, attachments: c.attachments,
    seq: c.seq,
    mentions: c.mentions,
  }
}
function toSignoffRow(s: PageSignoff): any {
  return {
    id: s.id, org_id: s.orgId, path: s.path, reviewer_id: s.reviewerId,
    signed_by_user_id: s.signedByUserId, note: s.note, signed_at: s.signedAt,
  }
}
function toReviewerRow(r: PageReviewer): any {
  return { id: r.id, org_id: r.orgId, name: r.name, role: r.role, color: r.color, sort_order: r.sortOrder }
}

export interface CreateCommentPayload {
  orgId: string; path: string; body: string
  authorId?: string | null; authorName?: string | null; reviewerId?: string | null
  parentId?: string | null; x?: number | null; y?: number | null; anchorSelector?: string | null
  /** page_reviewers ids named in the body (@kate). */
  mentions?: string[] | null
  /** The captured ReviewTarget — what this pin points at. */
  context?: Record<string, any> | null
}

export function useReviewsApi() {
  /** The whole per-page load: review row + comments + sign-offs (snake_case rows). */
  async function pageBundle(orgId: string, path: string) {
    const b = await $fetch<{ review: PageReview | null; comments: PageComment[]; signoffs: PageSignoff[] }>(
      '/api/v1/reviews/page', { query: { orgId, path } })
    return {
      review: toReviewRow(b.review),
      comments: b.comments.map(toCommentRow),
      signoffs: b.signoffs.map(toSignoffRow),
    }
  }

  /** Just the stage for one page (developer gate). */
  async function stage(orgId: string, path: string): Promise<string | null> {
    const r = await $fetch<{ stage: string | null }>('/api/v1/reviews/stage', { query: { orgId, path } })
    return r.stage
  }

  /** The org's APPROVED page paths. */
  async function approvedPaths(orgId: string): Promise<string[]> {
    return await $fetch<string[]>('/api/v1/reviews/approved', { query: { orgId } })
  }

  async function setStage(orgId: string, path: string, stageValue: string, approvedById?: string | null) {
    const r = await $fetch<PageReview>('/api/v1/reviews/set-stage', {
      method: 'POST', body: { orgId, path, stage: stageValue, approvedById: approvedById ?? null },
    })
    return toReviewRow(r)
  }

  async function createComment(payload: CreateCommentPayload) {
    const c = await $fetch<PageComment>('/api/v1/reviews/comments', { method: 'POST', body: payload })
    return toCommentRow(c)
  }

  async function setCommentResolved(id: string, resolved: boolean, resolvedById?: string | null) {
    const c = await $fetch<PageComment>(`/api/v1/reviews/comments/${id}`, {
      method: 'PATCH', body: { resolved, resolvedById: resolvedById ?? null },
    })
    return toCommentRow(c)
  }

  /**
   * Builder approving a suggestion as real work (or taking that back). Only
   * ready comments can be handed to Claude.
   */
  async function setCommentReady(id: string, ready: boolean) {
    const c = await $fetch<PageComment>(`/api/v1/reviews/comments/${id}`, { method: 'PATCH', body: { ready } })
    return toCommentRow(c)
  }

  /** Replace a comment's attachment list (adding or removing an image). */
  async function setCommentAttachments(id: string, attachments: { url: string; name?: string | null }[]) {
    const c = await $fetch<PageComment>(`/api/v1/reviews/comments/${id}`, { method: 'PATCH', body: { attachments } })
    return toCommentRow(c)
  }

  /**
   * Re-anchor a pin onto a different element. Position and captured context go
   * together — a pin whose coordinates and description disagree is worse than
   * either on its own.
   */
  async function moveComment(id: string, anchor: {
    x: number | null; y: number | null; anchorSelector: string | null; context: Record<string, any> | null
  }) {
    const c = await $fetch<PageComment>(`/api/v1/reviews/comments/${id}`, { method: 'PATCH', body: anchor })
    return toCommentRow(c)
  }

  /**
   * Every open comment in the org, across all pages — the whole backlog.
   * The per-page bundle cannot answer "what is outstanding overall", which is
   * the one question a queue has to be able to answer.
   */
  async function allOpenComments(orgId: string) {
    const rows = await $fetch<PageComment[]>('/api/v1/reviews/all', { query: { orgId } })
    return rows.map(toCommentRow)
  }

  /**
   * Edit a comment's text. Mentions travel with it: an edit that deletes the
   * "@kate" must stop addressing Kate, or she keeps seeing a question the
   * comment no longer asks.
   */
  async function updateCommentBody(id: string, body: string, mentions?: string[] | null) {
    const c = await $fetch<PageComment>(`/api/v1/reviews/comments/${id}`, {
      method: 'PATCH', body: { body, ...(mentions === undefined ? {} : { mentions: mentions?.length ? mentions : null }) },
    })
    return toCommentRow(c)
  }

  /**
   * Record that Claude actioned a comment. Deliberately NOT a resolve — the
   * comment stays open with a robot icon and a human signs it off.
   */
  async function setCommentClaudeStatus(id: string, status: 'done' | 'needs_info' | null, note?: string | null) {
    const c = await $fetch<PageComment>(`/api/v1/reviews/comments/${id}`, {
      method: 'PATCH', body: { claudeStatus: status, claudeNote: note ?? null },
    })
    return toCommentRow(c)
  }

  async function deleteComment(id: string): Promise<void> {
    await $fetch(`/api/v1/reviews/comments/${id}`, { method: 'DELETE' })
  }

  /**
   * Write the open comments out as a task brief (docs/review-tasks.md) and
   * return it. Dev-only on the server.
   */
  async function buildBrief(orgId: string, path?: string | null, ids?: string[] | null) {
    return await $fetch<BriefResult>('/api/v1/reviews/brief', {
      method: 'POST', body: { orgId, path: path ?? null, ids: ids?.length ? ids : null },
    })
  }

  async function createSignoff(orgId: string, path: string, reviewerId: string, signedByUserId?: string | null) {
    const s = await $fetch<PageSignoff>('/api/v1/reviews/signoffs', {
      method: 'POST', body: { orgId, path, reviewerId, signedByUserId: signedByUserId ?? null },
    })
    return toSignoffRow(s)
  }

  async function deleteSignoff(id: string): Promise<void> {
    await $fetch(`/api/v1/reviews/signoffs/${id}`, { method: 'DELETE' })
  }

  async function reviewers(orgId: string) {
    const rows = await $fetch<PageReviewer[]>('/api/v1/reviews/reviewers', { query: { orgId } })
    return rows.map(toReviewerRow)
  }

  /** Seed the default reviewer set if the org has none; returns the resolved list. */
  async function ensureReviewers(orgId: string, defaults: { name: string; role?: string | null; color?: string | null; sortOrder: number }[]) {
    const rows = await $fetch<PageReviewer[]>('/api/v1/reviews/reviewers/ensure', {
      method: 'POST', body: { orgId, defaults },
    })
    return rows.map(toReviewerRow)
  }

  async function createReviewer(orgId: string, name: string, role: string | null, color: string | null, sortOrder: number) {
    const r = await $fetch<PageReviewer>('/api/v1/reviews/reviewers', {
      method: 'POST', body: { orgId, name, role, color, sortOrder },
    })
    return toReviewerRow(r)
  }

  /**
   * The org-wide sign-off report (pages/dev/review). Reviewers + signoffs come
   * back in the snake_case ROW shape the page's template reads (signed_at etc.).
   */
  /**
   * Open comments across the whole org that name this reviewer. The panel is
   * page-scoped, so this is the only way a mention reaches its target.
   */
  async function mentionsFor(orgId: string, reviewerId: string) {
    const rows = await $fetch<PageComment[]>('/api/v1/reviews/mentions', { query: { orgId, reviewerId } })
    return rows.map(toCommentRow)
  }

  async function report(orgId: string) {
    const r = await $fetch<ReviewReport>('/api/v1/reviews/report', { query: { orgId } })
    return {
      reviewers: r.reviewers.map(toReviewerRow),
      reviews: r.reviews,
      comments: r.comments,
      signoffs: r.signoffs.map(s => ({ path: s.path, reviewer_id: s.reviewerId, signed_at: s.signedAt })),
    }
  }

  return {
    pageBundle, stage, approvedPaths, setStage,
    createComment, setCommentResolved, updateCommentBody, setCommentClaudeStatus,
    setCommentReady, setCommentAttachments, moveComment, deleteComment,
    allOpenComments,
    createSignoff, deleteSignoff,
    reviewers, ensureReviewers, createReviewer, report, buildBrief, mentionsFor,
  }
}
