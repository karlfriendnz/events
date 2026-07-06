// Help documentation engine.
//
// Help articles are authored ONCE, platform-wide, by super-admins (/admin/help)
// and written with terminology TOKENS ({member}/{groups}/{term}…). Each club
// sees them rendered in its OWN words via the terminology engine, and only the
// articles it can actually use:
//   * the article's module must be enabled for the club (useOrgModules), and
//   * the user's role must have READ access to the article's resource (useCan).
// Articles are structured (explanation + ordered steps) so a chatbot can consume
// them later.

import type { TermDef } from './useTerminology'

export interface HelpStep { title: string; body: string }
export interface HelpArticle {
  id: string
  key: string
  title: string
  explanation: string
  steps: HelpStep[]
  module: string | null
  resource: string | null
  route: string | null
  sort_order: number
  status: 'draft' | 'published'
  updated_at?: string
  created_at?: string
}

// Terminology tokens the content may use → the TERM_DEFS key + plural flag.
// Built from the canonical single-word defaults (member/members, group/groups…);
// a leading capital in the written token ({Member}) capitalises the label.
function buildTokenMap(): Record<string, { key: string; plural: boolean }> {
  const out: Record<string, { key: string; plural: boolean }> = {}
  for (const def of TERM_DEFS) {
    if (!def.singular.includes(' ')) out[def.singular.toLowerCase()] = { key: def.key, plural: false }
    if (!def.plural.includes(' ')) out[def.plural.toLowerCase()] = { key: def.key, plural: true }
  }
  return out
}
const TOKEN_MAP = buildTokenMap()
const DEFAULT_BY_KEY: Record<string, TermDef> = Object.fromEntries(TERM_DEFS.map(t => [t.key, t]))

// Resolve one term key against a resolved overrides map (pure — mirrors
// useTerminology().term, but with no Nuxt-context dependency so this is safe to
// call inside a computed / render).
function resolveTerm(termMap: Record<string, { singular?: string; plural?: string }>, key: string, plural: boolean): string {
  const def = DEFAULT_BY_KEY[key]
  const ov = termMap?.[key] || {}
  if (plural) return ov.plural || def?.plural || (def?.singular ? def.singular + 's' : key)
  return ov.singular || def?.singular || key
}

/**
 * Replace terminology tokens in a string with a club's resolved labels.
 * `termMap` is a resolved overrides map from useTerminology().resolveTerminology
 * (or useTerms().map). {member} → member label, {members} → plural,
 * {Member}/{Members} → capitalised. Pure — no Nuxt context needed.
 */
export function renderHelpTokens(text: string, termMap: Record<string, { singular?: string; plural?: string }>): string {
  return (text || '').replace(/\{([A-Za-z][A-Za-z-]*)\}/g, (whole, word: string) => {
    const spec = TOKEN_MAP[word.toLowerCase()]
    if (!spec) return whole
    let label = resolveTerm(termMap, spec.key, spec.plural)
    if (word[0] === word[0].toUpperCase()) label = label.charAt(0).toUpperCase() + label.slice(1)
    return label
  })
}

export function useHelp() {
  const db = useDb()
  const modules = useOrgModules()
  const { can, load: loadCan, loaded: canLoaded } = useCan()

  function normalise(row: any): HelpArticle {
    return {
      id: row.id,
      key: row.key,
      title: row.title ?? '',
      explanation: row.explanation ?? '',
      steps: Array.isArray(row.steps) ? row.steps : [],
      module: row.module ?? null,
      resource: row.resource ?? null,
      route: row.route ?? null,
      sort_order: row.sort_order ?? 0,
      status: row.status === 'published' ? 'published' : 'draft',
      updated_at: row.updated_at,
      created_at: row.created_at,
    }
  }

  /**
   * Load help articles. `all` (admin) returns everything; otherwise returns only
   * PUBLISHED articles the current club + user can see, filtered client-side by
   * module-enabled AND role-read-access.
   */
  async function loadHelpArticles(opts?: { all?: boolean }): Promise<HelpArticle[]> {
    let q = (db.from as any)('help_articles').select('*').order('sort_order').order('title')
    if (!opts?.all) q = q.eq('status', 'published')
    const { data } = await q
    const rows: HelpArticle[] = (data ?? []).map(normalise)
    if (opts?.all) return rows

    // Ensure the club's module config + the user's effective permissions are ready.
    await Promise.all([
      modules.loadModules(),
      canLoaded.value ? Promise.resolve() : loadCan(),
    ])
    return rows.filter(a => modules.isEnabled(a.module) && (!a.resource || can(a.resource, 'read')))
  }

  // ── Admin CRUD ──
  async function saveHelpArticle(article: Partial<HelpArticle> & { key: string; title: string }): Promise<HelpArticle | null> {
    const payload: any = {
      key: article.key.trim(),
      title: article.title ?? '',
      explanation: article.explanation ?? '',
      steps: article.steps ?? [],
      module: article.module || null,
      resource: article.resource || null,
      route: article.route?.trim() || null,
      sort_order: article.sort_order ?? 0,
      status: article.status === 'published' ? 'published' : 'draft',
      updated_at: new Date().toISOString(),
    }
    if (article.id) {
      const { data } = await (db.from as any)('help_articles').update(payload).eq('id', article.id).select('*').maybeSingle()
      return data ? normalise(data) : null
    }
    const { data } = await (db.from as any)('help_articles').insert(payload).select('*').maybeSingle()
    return data ? normalise(data) : null
  }

  async function deleteHelpArticle(id: string) {
    await (db.from as any)('help_articles').delete().eq('id', id)
  }

  return { loadHelpArticles, saveHelpArticle, deleteHelpArticle, renderHelpTokens }
}
