/**
 * "Take me to what this comment is about."
 *
 * Clicking a review comment scrolls to the element it points at — but only if
 * that element is on screen. On a wizard, a tabbed page or anything with
 * dialogs, most of the app isn't in the DOM at any given moment, so there is
 * nothing to scroll to until the right view is showing.
 *
 * <ReviewWidget> can't know how any page changes view (steps, tabs, dialogs are
 * all page-private), and no page should have to know the review tool exists.
 * So the widget ASKS, by firing `review:goto` with the scope and dialog its pin
 * captured, and a page that can honour it listens. This composable is that
 * listener: one call, cleaned up automatically.
 *
 * A page that doesn't call it simply never responds, and the click falls back to
 * highlighting the pin — no page is obliged to participate.
 *
 * ── Adding a page ──────────────────────────────────────────────────────────
 *  1. Declare WHERE YOU ARE, so a pin captures it: put `data-review-scope` on
 *     the container that changes — the wizard shell, the tab panel:
 *
 *       <div :data-review-scope="`Step ${i + 1} of ${steps.length} · ${step.label}`">
 *       <div :data-review-scope="`Tab: ${activeTab}`">
 *
 *  2. Say HOW TO GET BACK there:
 *
 *       useReviewGoto(({ scope, dialog, stepLabel }) => {
 *         if (stepLabel) {
 *           const i = steps.value.findIndex(s => s.label.toLowerCase() === stepLabel)
 *           if (i >= 0) activeStep.value = i
 *         }
 *         if (dialog === 'Add discount') openDiscount()
 *       })
 *
 * Match steps/tabs on their LABEL, not their number: conditional steps mean
 * "step 4" is a different screen for different records, while "Fees" is always
 * Fees. `stepLabel` is pre-parsed for exactly that reason.
 *
 * Match dialogs against a SHORT EXPLICIT LIST. Opening the wrong dialog because
 * a title looked similar is worse than opening none at all.
 */
export interface ReviewGotoRequest {
  /** The full captured scope, e.g. "Step 3 of 6 · Fees". */
  scope: string | null
  /** Title of the dialog the pin was inside, if any, e.g. "Add Discount". */
  dialog: string | null
  /**
   * The step/tab name pulled out of `scope`, lower-cased — the part you almost
   * always want. Null when the scope names no step.
   */
  stepLabel: string | null
  /** The comment being opened, if you need anything else about it. */
  commentId: string | null
}

/** "Step 3 of 6 · Fees" → "fees". Scopes compose with ›, so stop at the first. */
export function reviewStepLabel(scope: string | null | undefined): string | null {
  if (!scope || !scope.includes('·')) return null
  const label = scope.split('·').pop()?.split('›')[0]?.trim().toLowerCase()
  return label || null
}

export function useReviewGoto(handler: (req: ReviewGotoRequest) => void) {
  if (typeof window === 'undefined') return
  const onGoto = (e: Event) => {
    const d = (e as CustomEvent).detail ?? {}
    const scope = typeof d.scope === 'string' ? d.scope : null
    handler({
      scope,
      dialog: typeof d.dialog === 'string' ? d.dialog : null,
      stepLabel: reviewStepLabel(scope),
      commentId: typeof d.commentId === 'string' ? d.commentId : null,
    })
  }
  onMounted(() => window.addEventListener('review:goto', onGoto))
  onBeforeUnmount(() => window.removeEventListener('review:goto', onGoto))
}
