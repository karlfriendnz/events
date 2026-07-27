/**
 * Turn open review comments into a task brief an agent can work from.
 *
 * The problem this solves: a pin stores what the reviewer TYPED, which is
 * shorthand for what they were looking at — "Padding", "remove this". Read back
 * later, out of context, most of them are unactionable. The capture in
 * utils/reviewTarget.ts records what the comment pointed at; this renders the
 * two together so each item reads as an instruction with an address.
 *
 * Output is markdown on purpose: it is the format a human can skim in the repo
 * and an agent can consume without a parser.
 */
import type { PageComment } from '../../shared/contracts/review'

/** One line: "Step 4 · Who it's for › Fees › button 'Add fee'". */
function whereLine(ctx: Record<string, any> | null): string | null {
  if (!ctx) return null
  // A wizard step is usually NAMED after the section it contains, so scope and
  // section repeat ("Step 1 · Event info › Event info"). Drop the echo.
  const scope: string | null = ctx.scope ?? null
  const section: string | null = ctx.section && !(scope || '').includes(ctx.section) ? ctx.section : null
  const bits = [
    scope,
    ctx.dialog && ctx.dialog !== 'dialog' ? `dialog "${ctx.dialog}"` : null,
    section,
    ctx.label,
  ].filter(Boolean)
  const text = typeof ctx.text === 'string' && ctx.text.length <= 40 ? ctx.text : null
  bits.push(text ? `${ctx.tag} "${text}"` : String(ctx.tag ?? 'element'))
  return bits.join(' › ')
}

function ago(iso: string | null): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export interface BriefOptions {
  orgId: string
  /** Only this page key; omitted = the whole org. */
  path?: string | null
  /** ISO timestamp for the header — passed in so the output is testable. */
  now?: string
  /**
   * Origin the brief was served from (e.g. http://localhost:3005), stamped into the
   * hand-back instructions. The dev server's port MOVES — Nuxt takes the next free one
   * when 3000 is busy — and an agent reading this file has no way to know which. It
   * guessed 3002, got connection-refused, and reported the items as unmarkable. The
   * server generating the brief is the one thing that knows its own address, so it says.
   */
  baseUrl?: string | null
}

export function buildBriefMarkdown(comments: PageComment[], opts: BriefOptions): {
  markdown: string; taskCount: number; pageCount: number
} {
  // Replies hang off their parent rather than becoming tasks of their own — a
  // reply is usually the clarification that makes the parent actionable.
  const repliesByParent = new Map<string, PageComment[]>()
  const roots: PageComment[] = []
  for (const c of comments) {
    if (c.parentId) {
      const list = repliesByParent.get(c.parentId) ?? []
      list.push(c)
      repliesByParent.set(c.parentId, list)
    } else {
      roots.push(c)
    }
  }

  const byPath = new Map<string, PageComment[]>()
  for (const c of roots) {
    const list = byPath.get(c.path) ?? []
    list.push(c)
    byPath.set(c.path, list)
  }
  // Page-level comments (no pin) first within a page — they are usually the
  // "about this whole screen" notes and set up everything under them.
  for (const list of byPath.values()) {
    list.sort((a, b) => {
      const ap = a.x == null ? 0 : 1
      const bp = b.x == null ? 0 : 1
      if (ap !== bp) return ap - bp
      return String(a.createdAt).localeCompare(String(b.createdAt))
    })
  }

  // The dev server's address, so every PATCH below is copy-pasteable as written.
  const base = opts.baseUrl || 'http://localhost:3000'

  const L: string[] = []
  L.push(`# Review tasks — ${roots.length} open across ${byPath.size} page${byPath.size === 1 ? '' : 's'}`)
  L.push('')
  L.push(`Generated ${opts.now ?? new Date().toISOString()} from the in-app review widget.`)
  L.push('')
  L.push(`The app is running at **${base}** — that's where the PATCHes below go. Don't`)
  L.push('assume a port: this line is written by the server that served the brief.')
  L.push('')
  L.push('**How to work this list** — triage first, then one at a time.')
  L.push('')
  L.push('**Step 1 — triage before writing any code.** Read every item and tell Karl,')
  L.push('in one short list, which you understand and which you do not. He would much')
  L.push('rather answer three questions up front than review three wrong changes. Do')
  L.push('not start until he has replied.')
  L.push('')
  L.push('**Step 2 — then work them ONE AT A TIME**, in the order Karl agrees. After')
  L.push('each item, mark it and move to the next. Do NOT batch a dozen changes and')
  L.push('report at the end: the whole point of marking each one is that Karl checks it')
  L.push('while you build the next.')
  L.push('')
  L.push('Marking an item done — note this does NOT resolve it. A robot icon appears')
  L.push('against the comment in the panel and Karl signs it off himself:')
  L.push('')
  L.push('```')
  L.push(`PATCH ${base}/api/v1/reviews/comments/<id>`)
  L.push('{ "claudeStatus": "done", "claudeNote": "what changed, one line" }')
  L.push('```')
  L.push('')
  L.push('Anything you cannot place or understand — ASK, do not guess. A change to the')
  L.push('wrong element is worse than an unactioned note, and this puts the question on')
  L.push('the comment itself where Karl will see it:')
  L.push('')
  L.push('```')
  L.push(`PATCH ${base}/api/v1/reviews/comments/<id>`)
  L.push('{ "claudeStatus": "needs_info", "claudeNote": "the question, one line" }')
  L.push('```')
  L.push('')

  for (const [path, list] of byPath) {
    L.push('---')
    L.push('')
    L.push(`## \`${path}\` — ${list.length} open`)
    L.push('')
    list.forEach((c, i) => {
      const ctx = c.context
      L.push(`### ${i + 1}. ${c.body.replace(/\s+/g, ' ').trim()}`)
      L.push('')
      L.push(`- **id**: \`${c.id}\``)
      const where = whereLine(ctx)
      if (where) L.push(`- **where**: ${where}`)
      if (ctx?.componentFile) L.push(`- **file**: \`${ctx.componentFile}\``)
      if (Array.isArray(ctx?.componentChain) && ctx.componentChain.length > 1) {
        L.push(`- **components**: ${ctx.componentChain.join(' › ')}`)
      }
      if (ctx?.selector) L.push(`- **selector**: \`${ctx.selector}\``)
      if (ctx?.placeholder) L.push(`- **placeholder**: "${ctx.placeholder}"`)
      if (!ctx) {
        L.push(c.x == null
          ? '- **where**: page-level note (not pinned to an element)'
          : `- **where**: ⚠️ pinned at (${c.x}, ${c.y}) with no element captured — this comment predates context capture, so the target has to be confirmed before acting`)
      }
      // Attachments are cited as REPO-RELATIVE PATHS, not URLs: the uploader
      // writes into public/uploads, so this is a file the agent can open with
      // its own Read tool rather than a link it can only look at.
      if (c.attachments?.length) {
        const files = c.attachments.map(a => {
          const rel = a.url.startsWith('/') ? `public${a.url}` : a.url
          return a.name ? `\`${rel}\` (${a.name})` : `\`${rel}\``
        })
        L.push(`- **images** (READ these — they carry the detail): ${files.join(', ')}`)
      }
      if (c.claudeStatus === 'done') {
        L.push(`- **already actioned**: ${c.claudeNote || 'done'} — awaiting sign-off, skip unless reopening`)
      }
      const by = [c.authorName, ago(c.createdAt)].filter(Boolean).join(' · ')
      if (by) L.push(`- **by**: ${by}`)
      const replies = repliesByParent.get(c.id) ?? []
      for (const r of replies) {
        L.push(`- **reply** (${r.authorName || '?'}): ${r.body.replace(/\s+/g, ' ').trim()}`)
      }
      L.push('')
    })
  }

  return { markdown: L.join('\n'), taskCount: roots.length, pageCount: byPath.size }
}
