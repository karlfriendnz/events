/**
 * What did the reviewer actually CLICK?
 *
 * A review pin stores (x, y). That is enough to draw the pin back in the right
 * place and useless for anything else — "Padding" at (126, 186) tells a reader
 * nothing. This module turns the clicked element into a sentence a human (or an
 * agent) can act on: which field, in which section, rendered by which component.
 *
 * DELIBERATELY STANDALONE — no imports, no framework, no app types. It touches
 * only `document` and the element handed to it, so the same file can be dropped
 * into a browser-extension content script and work on any site. Everything
 * app-specific lives in the class names it *looks* for, never in what it needs.
 *
 * The Vue lookup is a bonus, not a dependency: Vue only tags DOM nodes with
 * `__vueParentComponent` in a DEV build, so `componentFile` is populated while
 * developing and simply null in production. Every lookup is best-effort — a
 * capture failure must never stop someone leaving a comment.
 */

export interface ReviewTarget {
  /** Tag name, lowercased — 'button', 'input', … */
  tag: string
  /** Short, readable CSS-ish path (last 4 levels) for eyeballing + re-finding. */
  selector: string
  /** The element's own visible text, trimmed and capped. */
  text: string | null
  /** The FIELD this element belongs to ("Who can see it"). */
  label: string | null
  /** The SECTION/card it sits in ("Event info"). */
  section: string | null
  /** Title of the dialog it is inside, when it is inside one. */
  dialog: string | null
  /**
   * WHICH VIEW of the page this was — "Step 4 · Who it's for", "Tab: Invitees".
   * A wizard is seven screens sharing one route, so without this every step's
   * comments pile onto one indistinguishable page. Declared by the page via
   * `data-review-scope` (one attribute on a wizard shell covers every wizard
   * built on it), with a generic active-step sniff as the fallback so this also
   * works on pages that declare nothing.
   */
  scope: string | null
  placeholder: string | null
  /** Nearest owning component ('EventVisibilityPicker'). Dev builds only. */
  component: string | null
  /** Its source file ('components/EventVisibilityPicker.vue'). Dev builds only. */
  componentFile: string | null
  /** Component ancestry, nearest first — the render path to this element. */
  componentChain: string[]
  /** Full URL at capture time (the pageKey drops the query + ids). */
  url: string
  /**
   * Structural nth-child path from <body>. This is what lets a pin RE-FIND its
   * element later: unlike `selector` it is unambiguous, and unlike (x, y) it is
   * unaffected by the window resizing, a section collapsing, or content above
   * reflowing. Re-render of the same page usually reproduces it exactly.
   */
  domPath: string
  /**
   * Where in the element the click landed, as a 0..1 fraction of its box. The
   * pin is redrawn at rect + (offset × size), so it keeps its spot on the thing
   * it points at as that thing changes size.
   */
  offsetX: number
  offsetY: number
}

const MAX_TEXT = 120
const MAX_CLIMB = 8

function clean(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t
}

/** Text of an element EXCLUDING nested interactive children, so a card's
 *  heading doesn't come back with every button label glued onto it. */
function ownText(el: Element): string | null {
  const parts: string[] = []
  el.childNodes.forEach(n => {
    if (n.nodeType === Node.TEXT_NODE) parts.push(n.textContent || '')
    else if (n.nodeType === Node.ELEMENT_NODE) {
      const e = n as Element
      if (!/^(button|input|select|textarea|svg)$/i.test(e.tagName)) parts.push(e.textContent || '')
    }
  })
  return clean(parts.join(' '))
}

/**
 * A short CSS path. Not guaranteed unique — it exists to be READ, and to give a
 * rough re-find hint. Ids and the first meaningful class only; Tailwind utility
 * soup is filtered out because 'flex items-center gap-2' identifies nothing.
 */
function shortSelector(el: Element): string {
  const seg = (e: Element): string => {
    if (e.id) return `#${e.id}`
    const tag = e.tagName.toLowerCase()
    const klass = Array.from(e.classList).find(c =>
      // Keep semantic classes; drop utilities and framework internals.
      !/^(p|m|px|py|mx|my|mt|mb|ml|mr|w|h|gap|flex|grid|text|bg|border|rounded|shadow|absolute|relative|top|left|right|bottom|z|min|max|overflow|items|justify|space|hidden|block|inline|sm:|md:|lg:|xl:)[-:]?/.test(c)
      && c.length > 2 && !/^(ng|v)-/.test(c),
    )
    return klass ? `${tag}.${klass}` : tag
  }
  const path: string[] = []
  let cur: Element | null = el
  for (let i = 0; cur && i < 4 && cur !== document.body; i++) {
    path.unshift(seg(cur))
    cur = cur.parentElement
  }
  return path.join(' > ')
}

/**
 * Unambiguous structural path from <body>: 'body>div:2>main>section:1>button:3'.
 * Uses ids as shortcuts where present (an id makes everything below it moot).
 */
function domPathOf(el: Element): string {
  const parts: string[] = []
  let cur: Element | null = el
  while (cur && cur !== document.documentElement) {
    if (cur.id) { parts.unshift(`#${cur.id}`); break }
    const parent: Element | null = cur.parentElement
    if (!parent) { parts.unshift(cur.tagName.toLowerCase()); break }
    const idx = Array.prototype.indexOf.call(parent.children, cur)
    parts.unshift(`${cur.tagName.toLowerCase()}:${idx}`)
    cur = parent
  }
  return parts.join('>')
}

/**
 * Walk a `domPath` back to a live element. Returns null the moment a step is
 * missing — a WRONG element would move the pin somewhere misleading, which is
 * worse than falling back to the stored coordinates.
 */
export function elementFromDomPath(path: string | null | undefined): Element | null {
  if (!path) return null
  try {
    const steps = path.split('>')
    let cur: Element | null = null
    for (const step of steps) {
      if (step.startsWith('#')) {
        cur = document.getElementById(step.slice(1))
        if (!cur) return null
        continue
      }
      const [tag, idxRaw] = step.split(':')
      const idx = Number(idxRaw)
      const children: Element[] = cur
        ? Array.from(cur.children)
        : Array.from(document.documentElement.children)
      const next = Number.isFinite(idx) ? children[idx] : undefined
      if (!next || next.tagName.toLowerCase() !== tag) return null
      cur = next
    }
    return cur
  } catch {
    return null
  }
}

/**
 * Does this element still look like the thing that was pinned?
 *
 * Load-bearing for review comments, which are keyed by ROUTE PATTERN — a pin
 * left on one event shows on every event. A different record renders a
 * different DOM, so the stored structural path can land on a real element that
 * is simply the wrong one (a path to "session 3" hits a different session, or
 * nothing like it). Matching the identity we captured catches that; without
 * this check the pin would sit confidently on the wrong control.
 */
function looksLikeTarget(el: Element, t: ReviewTarget): boolean {
  if (el.tagName.toLowerCase() !== t.tag) return false
  // LABEL is identity; TEXT is often just the current VALUE. A time field reads
  // "9:00 am" — change it to "10:00 am" and a text comparison decides this is a
  // different element, so the pin abandons the control it was placed on and
  // falls back to stale coordinates. So when we know the field's name, that
  // alone decides.
  if (t.label) return findLabel(el) === t.label
  // No label captured (an unlabelled div/button): text is the only identity we
  // have, so it has to serve.
  if (t.text) return clean(el.textContent) === t.text
  // Nothing distinctive at all — the structural path is all there is, and
  // trusting it beats losing the pin.
  return true
}

/**
 * Find the element a stored target points at. Tries the exact structural path
 * (verified — see above), then falls back to matching on the visible
 * identifiers, which survives markup that shifted since the pin was made.
 */
export function resolveTargetElement(t: ReviewTarget | null | undefined): Element | null {
  if (!t) return null
  try {
    const exact = elementFromDomPath(t.domPath)
    if (exact && exact.isConnected && looksLikeTarget(exact, t)) return exact

    if (!t.text && !t.label) return null
    const candidates = Array.from(document.querySelectorAll(t.tag))
    // Prefer a candidate that agrees on label AND section — on a page with
    // repeated rows ("Amount" ×10) the section is what tells them apart.
    const strong = candidates.find(el =>
      (!t.label || findLabel(el) === t.label)
      && (!t.text || clean(el.textContent) === t.text)
      && (!t.section || findSection(el) === t.section))
    if (strong) return strong
    return candidates.find(el => looksLikeTarget(el, t)) ?? null
  } catch {
    return null
  }
}

/** The field name for this element, by decreasing reliability. */
function findLabel(el: Element): string | null {
  const aria = clean(el.getAttribute('aria-label'))
  if (aria) return aria

  // A BUTTON IS NAMED BY ITS OWN TEXT. Everything below this looks for a label
  // pointing AT the element (aria-labelledby, label[for], a wrapping <label>, a
  // sibling .field-label) — all form-field conventions that a button matches
  // none of. So a pin dropped on a button came back with no name at all, and
  // "New event › button" is unactionable when the dialog holds five of them
  // sharing a class: the only way to resolve it was to ask which one.
  const tag = el.tagName.toLowerCase()
  if (tag === 'button' || tag === 'a' || tag === 'summary' || el.getAttribute('role') === 'button') {
    const own = clean(el.textContent)
    if (own) return own
    // An icon-only button has no text — fall back to what the tooltip says.
    const tip = clean(el.getAttribute('title') || el.getAttribute('data-pc-tooltip'))
    if (tip) return tip
  }

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const ref = document.getElementById(labelledBy)
    if (ref) { const t = clean(ref.textContent); if (t) return t }
  }

  if (el.id) {
    const forLabel = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
    if (forLabel) { const t = clean(forLabel.textContent); if (t) return t }
  }

  const wrapping = el.closest('label')
  if (wrapping) { const t = clean(wrapping.textContent); if (t) return t }

  // Climb, looking for a label that belongs to this row rather than the page.
  // `.field-label` is this app's own convention (main.css typography rules).
  let cur: Element | null = el.parentElement
  for (let i = 0; cur && i < MAX_CLIMB; i++) {
    const found = cur.querySelector(':scope > .field-label, :scope > label, :scope > .text-sm.font-medium, :scope > span.field-label')
    if (found && !found.contains(el)) { const t = clean(found.textContent); if (t) return t }
    cur = cur.parentElement
  }
  return null
}

/** The section/card heading this element sits under. */
function findSection(el: Element): string | null {
  let cur: Element | null = el.parentElement
  for (let i = 0; cur && i < MAX_CLIMB + 4; i++) {
    const head = cur.querySelector(':scope > .section-title, :scope > h1, :scope > h2, :scope > h3, :scope > header, :scope > div > .section-title, :scope > div > h2, :scope > div > h3')
    if (head && !head.contains(el)) { const t = ownText(head); if (t) return t }
    cur = cur.parentElement
  }
  return null
}

/**
 * Which VIEW of the page we are looking at — the wizard step, the open tab.
 *
 * Two sources, in order of trust:
 *  1. `data-review-scope` declared by the page. A wizard shell sets it once and
 *     every wizard built on it is covered; nothing else has to know.
 *  2. A generic sniff for the active item of a step/tab strip. Weaker, but it
 *     needs no cooperation — which is what makes this work on a foreign site.
 */
function findScope(el: Element): string | null {
  // Declared, nearest first (a step inside a tab inside a page all compose).
  const declared: string[] = []
  let cur: Element | null = el
  for (let i = 0; cur && i < 20; i++) {
    const v = cur.getAttribute?.('data-review-scope')
    if (v) declared.unshift(v)
    cur = cur.parentElement
  }
  if (declared.length) return clean(declared.join(' › '))

  // Nothing declared on this branch — check the document for a single scope
  // holder (a wizard shell that isn't an ancestor of the clicked node).
  const holders = Array.from(document.querySelectorAll('[data-review-scope]'))
  if (holders.length === 1) {
    const t = clean(holders[0].getAttribute('data-review-scope'))
    if (t) return t
  }

  // Generic fallback: the highlighted item of a step/tab strip.
  const active = document.querySelector(
    '[aria-current="step"], [aria-selected="true"], .p-steps-item.p-highlight, .p-stepper-item[data-p-active="true"]',
  )
  const t = clean(active?.textContent)
  return t && t.length <= 60 ? t : null
}

/** Title of the enclosing modal, whether a PrimeVue Dialog or a page-as-modal. */
function findDialog(el: Element): string | null {
  const host = el.closest('.p-dialog, .app-modal-overlay, [role="dialog"]')
  if (!host) return null
  const title = host.querySelector('.p-dialog-title, .modal-header-title, h1, h2')
  return clean(title?.textContent) || 'dialog'
}

/**
 * Walk Vue's component ancestry off the DOM node. Present only in dev builds —
 * absence is expected in production and is not an error.
 */
function findComponents(el: Element): { name: string | null; file: string | null; chain: string[] } {
  const empty = { name: null, file: null, chain: [] as string[] }
  try {
    let instance: any = null
    let cur: any = el
    // The nearest ancestor Vue bothered to tag.
    for (let i = 0; cur && i < MAX_CLIMB + 6; i++) {
      if (cur.__vueParentComponent) { instance = cur.__vueParentComponent; break }
      cur = cur.parentElement
    }
    if (!instance) return empty

    const chain: string[] = []
    let name: string | null = null
    let file: string | null = null
    let node: any = instance
    for (let i = 0; node && i < 12; i++) {
      const type = node.type || {}
      // __file is the absolute source path (vite plugin, dev only).
      const rawFile: string | undefined = type.__file
      const short = rawFile
        ? rawFile.replace(/^.*?\/(components|pages|layouts|app)\//, '$1/')
        : undefined
      const label: string | null = type.__name || type.name
        || (short ? short.split('/').pop()!.replace(/\.vue$/, '') : null)
      if (label && chain[chain.length - 1] !== label) chain.push(label)
      if (!name && label) { name = label; file = short ?? null }
      // First component with a real FILE wins as the actionable one — an
      // anonymous inline wrapper is not somewhere anyone can go and edit.
      if (!file && short) file = short
      node = node.parent
    }
    return { name, file, chain: chain.slice(0, 6) }
  } catch {
    return empty
  }
}

/**
 * Describe one element. Never throws — a partial capture beats a lost comment.
 * `point` is the click position in VIEWPORT coords; without it the pin is
 * treated as pointing at the element's centre.
 */
export function describeElement(
  el: Element | null,
  point?: { clientX: number; clientY: number } | null,
): ReviewTarget | null {
  if (!el || !(el instanceof Element)) return null
  try {
    const comp = findComponents(el)
    let offsetX = 0.5
    let offsetY = 0.5
    if (point) {
      const r = el.getBoundingClientRect()
      if (r.width > 0) offsetX = Math.min(1, Math.max(0, (point.clientX - r.left) / r.width))
      if (r.height > 0) offsetY = Math.min(1, Math.max(0, (point.clientY - r.top) / r.height))
    }
    return {
      domPath: domPathOf(el),
      offsetX: Number(offsetX.toFixed(4)),
      offsetY: Number(offsetY.toFixed(4)),
      tag: el.tagName.toLowerCase(),
      selector: shortSelector(el),
      text: clean(el.textContent),
      label: findLabel(el),
      section: findSection(el),
      dialog: findDialog(el),
      scope: findScope(el),
      placeholder: clean(el.getAttribute('placeholder')),
      component: comp.name,
      componentFile: comp.file,
      componentChain: comp.chain,
      url: typeof location !== 'undefined' ? location.href : '',
    }
  } catch {
    return null
  }
}

/** Describe whatever sits at a viewport point (for a pin dropped by coordinate). */
export function describePoint(clientX: number, clientY: number): ReviewTarget | null {
  try {
    return describeElement(document.elementFromPoint(clientX, clientY), { clientX, clientY })
  } catch {
    return null
  }
}

/**
 * One human-readable line: "Event info › Who can see it › button 'Public'".
 * Used in the panel tooltip and in the exported brief.
 */
export function describeTargetLine(t: ReviewTarget | null | undefined): string {
  if (!t) return ''
  // A wizard step is usually named after the section it holds, so scope and
  // section repeat ("Step 1 · Event info › Event info"). Drop the echo.
  const section = t.section && !(t.scope || '').includes(t.section) ? t.section : null
  const parts = [t.scope, t.dialog && `dialog "${t.dialog}"`, section, t.label].filter(Boolean)
  const what = t.text && t.text.length <= 40 ? `${t.tag} "${t.text}"` : t.tag
  parts.push(what)
  return parts.join(' › ')
}
