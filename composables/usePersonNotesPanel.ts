// Shared open-state for the <PersonNotes> slide-out drawer. Holds the id of the
// currently-open notes instance (or null), so (a) only one drawer shows at a
// time across every <PersonNotes> on the page, and (b) the layout can push its
// content left while a drawer is open — the same pattern as <ReviewWidget> /
// useReviewPanel.
export function usePersonNotesPanel() {
  return useState<string | null>('person-notes-active', () => null)
}
