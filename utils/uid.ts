/**
 * Generate a UUID that works everywhere the app runs.
 *
 * `crypto.randomUUID()` is only defined in a SECURE CONTEXT. That is normally
 * satisfied by https or localhost — but a page is only a secure context if
 * every one of its ancestors is too, so the moment this app is embedded in an
 * iframe on a plain-http host (the old FriendlyManager platform), the function
 * disappears and every call site throws
 *
 *     TypeError: crypto.randomUUID is not a function
 *
 * which surfaces as buttons that silently do nothing — "add fee row is not
 * working". Falling back keeps client-generated ids working in that context.
 *
 * The fallback uses crypto.getRandomValues (available in insecure contexts)
 * and only drops to Math.random if even that is missing. These ids identify
 * rows in a form before they are saved, so uniqueness matters and
 * unguessability does not.
 */
export function uid(): string {
  const c: Crypto | undefined = globalThis.crypto

  if (typeof c?.randomUUID === 'function') return c.randomUUID()

  if (typeof c?.getRandomValues === 'function') {
    const bytes = c.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant 10
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
