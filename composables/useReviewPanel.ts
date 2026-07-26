// Shared open-state for the <ReviewWidget> review/comment panel, so a trigger
// outside the widget (e.g. the left icon-rail comment button) can pop it open.
export function useReviewPanel() {
  return useState<boolean>('review-panel-open', () => false)
}

// Unresolved-comment count for the current page, published by <ReviewWidget>
// so the left-rail trigger can show a live badge.
export function useReviewCount() {
  return useState<number>('review-open-count', () => 0)
}

/**
 * How many open comments ACROSS THE ORG @mention the signed-in reviewer.
 *
 * Kept separate from useReviewCount rather than folded into it: "there are 6
 * comments on this page" and "someone asked YOU something" are different facts,
 * and adding them together would produce a number that means neither. The
 * header shows them as two badges for the same reason.
 */
export function useReviewMentionCount() {
  return useState<number>('review-mention-count', () => 0)
}
