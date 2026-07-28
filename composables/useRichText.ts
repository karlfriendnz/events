/**
 * Rich text → plain text.
 *
 * Descriptions and notes are authored in `<RichTextEditor>` (TipTap) and stored as
 * HTML, so anywhere the app shows one as TEXT rather than rendering it — a calendar
 * tooltip, a table cell, a CSV, an email subject — the raw markup shows through:
 * "<p>Test test test</p>" on screen, exactly as typed into the database.
 *
 * The fix is NOT `v-html`. These places want one clamped line, not a rendered
 * document, and v-html on stored content is an injection surface for a value the
 * public registration form can write.
 */
export function plainText(html?: string | null): string {
  if (!html) return ''
  const raw = String(html)
  // Fast path: no tags and no entities, so there's nothing to undo.
  if (!/[<&]/.test(raw)) return raw.trim()

  // Block boundaries become a SPACE before anything is stripped, or consecutive
  // paragraphs run together: "<p>one</p><p>two</p>" would read "onetwo".
  const spaced = raw.replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>|<br\s*\/?>/gi, ' ')

  // DOMParser rather than an element's innerHTML: it decodes entities properly
  // (&amp;, &nbsp;) while parsing INERTLY — no scripts run, no images fetch.
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(spaced, 'text/html')
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
  }
  // Server/worker fallback: strip tags and decode the handful of entities TipTap
  // actually emits. Deliberately not a full entity table — this path only exists
  // so the helper is safe to call outside the browser.
  return spaced
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

export function useRichText() {
  return { plainText }
}
