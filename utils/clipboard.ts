/**
 * Copy text to the clipboard, everywhere the app runs.
 *
 * `navigator.clipboard` is SECURE-CONTEXT ONLY, and a page counts as secure
 * only if every ancestor does too — so inside the old FriendlyManager
 * platform's iframe (plain http) the whole API is undefined.
 *
 * That produced a particularly nasty failure: call sites written as
 * `navigator.clipboard?.writeText(x)` swallowed it with optional chaining and
 * then cheerfully toasted "Link copied", so the user pasted nothing and had no
 * idea why. Anything that reports success has to actually know it succeeded.
 *
 * Falls back to the execCommand('copy') selection trick, which still works in
 * insecure contexts. Returns whether the copy actually happened, so callers can
 * tell the truth in their toast.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!import.meta.client || typeof text !== 'string') return false

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Permission denied or blocked by the host page — fall through.
    }
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    // Off-screen but still focusable: execCommand only copies a live selection.
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.top = '-1000px'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    el.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
