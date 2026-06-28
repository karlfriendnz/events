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
