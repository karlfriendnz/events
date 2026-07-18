// Discipline requirements (migration 266) — what a governing body DEMANDS of a
// person in one of its disciplines.
//
// THE WORKED EXAMPLE this whole model exists for:
//
//   Football          (root)              → Job    Is Not Empty
//   ├─ Junior Football (age_max 15)       → School Is Not Empty · Job EXEMPT
//   └─ Senior Football (age_min 16)       → (inherits Job Is Not Empty)
//
//   A 12-year-old in a class linked to Football resolves to Junior Football:
//     School is required; Job is shadowed by the exempt row.
//   A 30-year-old resolves to Senior Football: Job is required, School isn't.
//
//   "If I'm a junior I require my school; if I'm a senior I require my job" —
//   with no special cases.
//
// SUPERSEDES the dormant field_definitions.rules column (migration 141). Do not
// build the other half of it.
//
// Nothing here blocks a registration. Unmet requirements are FLAGS.
//
// Everything above the factory is PURE — no useDb/useOrg at module scope — so
// tests/unit and server routes can import it (the useCoreFields / useEventTokens
// shape). The unit test importing this file in a node env IS the purity guard.

import type { PersonFieldDef } from './usePersonFields'
// Explicit, not auto-imported: this file is imported directly by tests/unit (node
// env) and potentially by server routes, where Nuxt's auto-imports don't exist.
import { ageFromDob } from './useAge'

// ── Vocabulary ──────────────────────────────────────────────────────────────
// A deliberate SUPERSET of visibility_conditions (FormFieldAdvancedEditor.vue's
// operators, evaluated by FormRenderer.vue's condPasses).
//
// The shared five MUST stay identical in both places — if one gains a text
// operator, so does the other. The three numeric ones are ours alone, and the
// divergence is principled rather than drift: condPasses tests FORM ANSWERS
// matched by label, while a requirement tests STORED PERSON DATA including a
// computed age — something form answers have no concept of.
//
// There are already three condition vocabularies here (this one, useCustomReports'
// REPORT_OPS and useEventDiscounts'); do not add a fourth.
export type ReqOperator =
  | 'Equals' | 'Is Not' | 'Contains' | 'Is Empty' | 'Is Not Empty'
  | 'Is At Least' | 'Is At Most' | 'Is Between'

export const SHARED_OPERATORS: ReqOperator[] = ['Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty']
export const NUMERIC_OPERATORS: ReqOperator[] = ['Is At Least', 'Is At Most', 'Is Between']
export const REQUIREMENT_OPERATORS: ReqOperator[] = [...SHARED_OPERATORS, ...NUMERIC_OPERATORS]
export const VALUELESS_OPERATORS: ReqOperator[] = ['Is Empty', 'Is Not Empty']
/** Is Between takes a pair: value = [min, max]. */
export const RANGE_OPERATORS: ReqOperator[] = ['Is Between']

// The editor's single dropdown, phrased as the author would say it out loud —
// "School must be recorded", "Gender must be Female". The words carry the meaning,
// which is why there is ONE rule list rather than a screen per purpose.
//
// "Not required" is a LABEL for exempt — never a stored operator, which would
// diverge this vocabulary from visibility_conditions.
export interface ReqOption { label: string; exempt: boolean; operator: ReqOperator | null; numeric?: boolean }
export const REQUIREMENT_OPTIONS: ReqOption[] = [
  { label: 'must be recorded', exempt: false, operator: 'Is Not Empty' },
  { label: 'must be', exempt: false, operator: 'Equals' },
  { label: 'must not be', exempt: false, operator: 'Is Not' },
  { label: 'must contain', exempt: false, operator: 'Contains' },
  { label: 'must be at least', exempt: false, operator: 'Is At Least', numeric: true },
  { label: 'must be at most', exempt: false, operator: 'Is At Most', numeric: true },
  { label: 'must be between', exempt: false, operator: 'Is Between', numeric: true },
  { label: 'must be blank', exempt: false, operator: 'Is Empty' },
  { label: 'is not required here', exempt: true, operator: null },
]
export const optionFor = (r: { operator: ReqOperator; exempt: boolean }): ReqOption =>
  REQUIREMENT_OPTIONS.find(o => (r.exempt ? o.exempt : !o.exempt && o.operator === r.operator)) ?? REQUIREMENT_OPTIONS[0]

/**
 * What a rule MEANS, derived from how it's phrased — so the author never answers a
 * question the words already answer.
 *
 *   a PRESENCE test ("must be recorded") → data     → "chase them for it"
 *   a VALUE test    ("must be Female")   → identity → "they shouldn't be here"
 *
 * Every real example follows this. The narrow exception is a data-QUALITY rule
 * written as a value test — "GNZ Number must contain GNZ" means "fix their number",
 * not "they're not a gymnast". `purpose` is stored rather than computed at read
 * time precisely so that case can be overridden later without a migration.
 */
export function derivePurpose(r: { operator: ReqOperator; exempt: boolean }): ReqPurpose {
  if (r.exempt) return 'data'
  return r.operator === 'Is Not Empty' || r.operator === 'Is Empty' ? 'data' : 'identity'
}

// ── Types ───────────────────────────────────────────────────────────────────
/**
 * What a rule is SAYING — the club-side flag means something different for each,
 * and only the author knows which they meant (a top colour is data, yet "must have
 * a blue top to be part of this discipline" is identity).
 *   identity → who is IN the discipline      → unmet = "they shouldn't be here"
 *   data     → what must be RECORDED         → unmet = "chase them for it"
 */
export type ReqPurpose = 'identity' | 'data'

export interface DisciplineRequirement {
  id: string
  discipline_id: string
  field_key: string                 // core column name | field_definitions.id
  field_source: 'core' | 'custom'
  purpose: ReqPurpose
  operator: ReqOperator
  value: any
  exempt: boolean
  applies_to: string[]              // person_target_types.key[]; [] = defer to the field's own targets
  message: string | null
  sort_order: number
}

export interface ResolvedRequirement extends DisciplineRequirement {
  viaDisciplineId: string
  viaDisciplineName: string
  depth: number                     // 0 = authored on the discipline itself, 1 = its parent, …
  shadowedBy?: { disciplineId: string; disciplineName: string; depth: number }
}

export interface DisciplineNode {
  id: string
  name: string
  parent_id: string | null
  sort_order?: number
  /** The cast (mig 276): the OWNING BODY's person_target_types.key[] who take part.
   *  null/empty = says nothing, inherit from the parent. NOT "nobody takes part". */
  person_type_keys?: string[] | null
}

export interface Unmet {
  requirement: ResolvedRequirement
  fieldKey: string
  fieldLabel: string
  disciplineId: string              // where the rule was AUTHORED
  disciplineName: string
  reason: 'missing' | 'mismatch' | 'unknown'
  message: string
}

export interface Broken {           // admin-facing — never a person's fault, never a person flag
  requirement: ResolvedRequirement
  reason: 'field-not-in-catalogue'
}

// ── Small pure helpers ──────────────────────────────────────────────────────
const blank = (v: any) => v == null || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '')
const low = (v: any) => String(v ?? '').trim().toLowerCase()
// null for anything that isn't a real number. NB Number(null) is 0 and Number('')
// is 0 — so coercing straight to Number would read a person with no date of birth
// as age 0 and silently PASS them on "under 16". Guard the empties first.
const num = (v: any) => {
  if (v == null || v === '' || typeof v === 'boolean' || Array.isArray(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** The virtual field key whose value is computed from persons.dob, not stored. */
export const AGE_FIELD_KEY = 'age'

/**
 * One rule as a sentence — the SAME words the editor's dropdown uses, so the
 * review, the tree summary and the club's flag all read like what was written:
 * "must be recorded", "must be Female", "must be between 10 and 14".
 */
export function describeRequirement(r: Pick<DisciplineRequirement, 'operator' | 'value' | 'exempt'>): string {
  const label = optionFor(r).label
  if (r.exempt || VALUELESS_OPERATORS.includes(r.operator)) return label
  if (r.operator === 'Is Between') {
    const [lo, hi] = Array.isArray(r.value) ? r.value : [null, null]
    return lo != null && hi != null ? `${label} ${lo} and ${hi}`
      : lo != null ? `must be at least ${lo}`
      : hi != null ? `must be at most ${hi}` : label
  }
  return `${label} ${r.value ?? ''}`.trim()
}

/**
 * Discipline → root. CYCLE-SAFE: disciplines.parent_id has no DB cycle guard
 * (only the author-time check on the disciplines page prevents them), so a direct
 * DB edit or a bulk import could otherwise hang the browser.
 *
 * A parent_id absent from `all` is treated as root, mirroring the disciplines
 * page's parentKey() — so a filtered array degrades to "fewer rules" rather than
 * throwing.
 *
 * CALLER CONTRACT: pass the UNFILTERED disciplines for the owning org.
 */
export function disciplineChain(disciplineId: string, all: DisciplineNode[]): DisciplineNode[] {
  const byId = new Map(all.map(d => [d.id, d]))
  const chain: DisciplineNode[] = []
  const seen = new Set<string>()
  let cur = byId.get(disciplineId)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.push(cur)
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined
  }
  return chain
}

/**
 * Does this requirement apply to a person holding these types?
 *
 * applies_to empty ⇒ defer entirely to the FIELD's own targets[] (via the
 * fieldAppliesTo predicate the caller passes in). No field ⇒ applies.
 */
export function requirementApplies(
  req: Pick<DisciplineRequirement, 'applies_to'>,
  personTypeKeys: string[],
  fieldTargets?: string[],
): boolean {
  if (req.applies_to?.length) return req.applies_to.some(t => personTypeKeys.map(low).includes(low(t)))
  if (fieldTargets?.length) return fieldTargets.some(t => personTypeKeys.map(low).includes(low(t)))
  return true
}

/** The person types someone holds — person_types[] with the legacy person_type fallback (mig 172). */
export function personTypeKeysOf(person: any): string[] {
  const arr = Array.isArray(person?.person_types) ? person.person_types : []
  return (arr.length ? arr : [person?.person_type]).filter(Boolean)
}

// ── Closest-wins resolution ─────────────────────────────────────────────────
/**
 * CLOSEST-WINS, keyed by field_key, up the parent_id chain.
 *
 *   1. Filter to rows applying to opts.personTypeKeys FIRST. This ordering is
 *      load-bearing: a coach-scoped child row must not shadow a member-scoped
 *      parent row, or members silently lose the requirement. Omit the option and
 *      no filter applies (the admin's "show me everything" view).
 *   2. Group the survivors by field_key. For each key keep ONLY the rows from the
 *      CLOSEST discipline in the chain that has any rows for it — levels may be
 *      skipped. Everything further up for that key → `shadowed`.
 *   3. Within the winning level, if any row is non-exempt, drop that level's
 *      exempt rows (contradictory authoring — a rule that fires is visible and
 *      fixable; one that silently vanishes is not).
 *   4. Exempt rows contribute no test: they claim the key and vanish. `effective`
 *      holds testable rows only.
 *
 * Returns `shadowed` because closest-wins SILENTLY deletes an ancestor's rule —
 * the editor has to be able to show what it replaced. That's the whole cost of
 * this inheritance model, and it's paid in the UI or not at all.
 */
export function effectiveRequirements(
  disciplineId: string,
  allDisciplines: DisciplineNode[],
  allRequirements: DisciplineRequirement[],
  opts?: { personTypeKeys?: string[]; fieldTargetsFor?: (key: string) => string[] | undefined },
): { effective: ResolvedRequirement[]; shadowed: ResolvedRequirement[] } {
  const chain = disciplineChain(disciplineId, allDisciplines)
  if (!chain.length) return { effective: [], shadowed: [] }

  const depthOf = new Map(chain.map((d, i) => [d.id, i]))
  const applicable = allRequirements.filter((r) => {
    if (!depthOf.has(r.discipline_id)) return false
    if (!opts?.personTypeKeys) return true
    return requirementApplies(r, opts.personTypeKeys, opts.fieldTargetsFor?.(r.field_key))
  })

  const resolve = (r: DisciplineRequirement): ResolvedRequirement => {
    const via = chain[depthOf.get(r.discipline_id)!]
    return { ...r, viaDisciplineId: via.id, viaDisciplineName: via.name, depth: depthOf.get(r.discipline_id)! }
  }

  const byField = new Map<string, DisciplineRequirement[]>()
  for (const r of applicable) {
    const list = byField.get(r.field_key) ?? []
    list.push(r)
    byField.set(r.field_key, list)
  }

  const effective: ResolvedRequirement[] = []
  const shadowed: ResolvedRequirement[] = []

  for (const rows of byField.values()) {
    const winDepth = Math.min(...rows.map(r => depthOf.get(r.discipline_id)!))
    const winner = chain[winDepth]
    let winning = rows.filter(r => depthOf.get(r.discipline_id) === winDepth)
    // Rule 3 — a real rule beats a contradictory exempt row at the same level.
    if (winning.some(r => !r.exempt)) winning = winning.filter(r => !r.exempt)

    for (const r of winning) if (!r.exempt) effective.push(resolve(r))
    for (const r of rows) {
      if (depthOf.get(r.discipline_id) === winDepth) continue
      shadowed.push({ ...resolve(r), shadowedBy: { disciplineId: winner.id, disciplineName: winner.name, depth: winDepth } })
    }
  }

  const bySort = (a: ResolvedRequirement, b: ResolvedRequirement) => a.sort_order - b.sort_order || a.field_key.localeCompare(b.field_key)
  return { effective: effective.sort(bySort), shadowed: shadowed.sort(bySort) }
}

/**
 * THE CAST: whose person types take part in this discipline (mig 276).
 *
 * CLOSEST-WINS up the parent chain, like requirements: Juniors inherits Football's
 * cast unless it names its own. An empty/null list says NOTHING (inherit) rather
 * than "nobody takes part" — a discipline that meant nobody would be a discipline
 * with no members, which is not a thing anyone authors.
 *
 * Returns the BODY's own keys. Crossing to the club's words is the LINK's job
 * (useOrgFieldPolicy.clubTypesForCast) — the club may call them anything.
 */
export function castFor(disciplineId: string, allDisciplines: DisciplineNode[]): string[] {
  const chain = disciplineChain(disciplineId, allDisciplines)   // self first, then up
  for (const d of chain) {
    const keys = (d.person_type_keys ?? []).filter(Boolean)
    if (keys.length) return [...new Set(keys.map(k => k.toLowerCase()))]
  }
  return []
}

/**
 * Union ACROSS chains — a group may be linked to disciplines from several bodies,
 * and each names its own cast. Cricket NZ's Player does not shadow Auckland's.
 */
export function castForMany(disciplineIds: string[], allDisciplines: DisciplineNode[]): string[] {
  const out = new Set<string>()
  for (const id of disciplineIds ?? []) for (const k of castFor(id, allDisciplines)) out.add(k)
  return [...out]
}

/**
 * Union ACROSS chains. Closest-wins is PER-CHAIN only: member_group_disciplines is
 * many-to-many and multi-NSO by design, so Cricket NZ's School rule does not
 * shadow Auckland Cricket's — different authorities, both apply. Deduped by row id.
 */
export function effectiveRequirementsForMany(
  disciplineIds: string[],
  allDisciplines: DisciplineNode[],
  allRequirements: DisciplineRequirement[],
  opts?: { personTypeKeys?: string[]; fieldTargetsFor?: (key: string) => string[] | undefined },
): { effective: ResolvedRequirement[]; shadowed: ResolvedRequirement[] } {
  const effective = new Map<string, ResolvedRequirement>()
  const shadowed = new Map<string, ResolvedRequirement>()
  for (const id of disciplineIds) {
    const r = effectiveRequirements(id, allDisciplines, allRequirements, opts)
    for (const x of r.effective) effective.set(x.id, x)
    for (const x of r.shadowed) if (!effective.has(x.id)) shadowed.set(x.id, x)
  }
  // A row effective via one chain is never reported as shadowed via another.
  for (const id of effective.keys()) shadowed.delete(id)
  return { effective: [...effective.values()], shadowed: [...shadowed.values()] }
}

// ── Evaluation ──────────────────────────────────────────────────────────────
/**
 * THE catalogue contract (usePersonFields):
 *   core   → person[field_key]
 *   custom → person.custom_fields[field_key]
 * By KEY, not by label — which is what FormRenderer's condPasses gets wrong.
 *
 * 'age' is VIRTUAL: computed from persons.dob, never stored. Same trick
 * useCustomReports already uses for its 'age' report field — there is no
 * persons.age column and there should not be one. `asOf` lets a caller age
 * someone at an event date rather than today.
 */
export function personValueFor(
  person: any,
  req: Pick<DisciplineRequirement, 'field_key' | 'field_source'>,
  asOf?: Date,
): any {
  if (req.field_source === 'custom') return person?.custom_fields?.[req.field_key]
  if (req.field_key === AGE_FIELD_KEY) return ageFromDob(person?.dob, asOf ?? new Date())
  return person?.[req.field_key]
}

/**
 * null = unresolvable (the field isn't in the catalogue) — never a person's fault,
 * so it must never become a person flag. See brokenIn().
 *
 * Comparison deliberately deviates from condPasses' strict === on form-input
 * strings: requirements test STORED data, where gender is 'FEMALE' (uppercase per
 * the persons CHECK) while an admin picks 'Female' from a dropdown. Same low()
 * normalisation as useCustomReports.testFilter, and array-aware because
 * MULTI_SELECT custom fields store arrays.
 *
 * NB "Is Not" PASSES on a blank value ('' !== 'x') — identical to condPasses
 * today, and deliberate: presence is a separate test. It's a trap worth knowing:
 * `School Is Not "Home schooled"` on a child SHADOWS a parent's presence test, so
 * a junior with no school recorded becomes compliant.
 */
export function testRequirement(person: any, req: DisciplineRequirement, catalogue?: PersonFieldDef[], asOf?: Date): boolean | null {
  if (req.exempt) return true
  if (catalogue && !catalogue.some(f => f.key === req.field_key)) return null
  const v = personValueFor(person, req, asOf)
  const t = req.value
  switch (req.operator) {
    case 'Is Empty': return blank(v)
    case 'Is Not Empty': return !blank(v)
    case 'Equals': return Array.isArray(v) ? v.map(low).includes(low(t)) : low(v) === low(t)
    case 'Is Not': return Array.isArray(v) ? !v.map(low).includes(low(t)) : low(v) !== low(t)
    case 'Contains': return Array.isArray(v) ? v.some((x: any) => low(x).includes(low(t))) : low(v).includes(low(t))
    // Numeric. An unknown value (no dob, blank number) is UNTESTABLE, not a
    // failure — we can't prove a 17-year-old is out of band if we don't know
    // their age. It surfaces as its own note rather than a false accusation.
    case 'Is At Least': { const n = num(v), b = num(t); return n == null || b == null ? null : n >= b }
    case 'Is At Most': { const n = num(v), b = num(t); return n == null || b == null ? null : n <= b }
    case 'Is Between': {
      const n = num(v)
      const [lo, hi] = Array.isArray(t) ? [num(t[0]), num(t[1])] : [null, null]
      if (n == null) return null
      return (lo == null || n >= lo) && (hi == null || n <= hi)
    }
    default: return true
  }
}

/**
 * Which requirements this person fails, and why.
 *
 * Three reasons, and the third matters: 'unknown' is "we can't check" (no date of
 * birth, so an age rule is untestable) rather than "they failed". Reporting that as
 * a failure would accuse someone on the strength of data we don't have; reporting
 * nothing would hide a real gap. It's its own flag.
 *
 * A field the catalogue doesn't know is never a person's fault — see brokenIn.
 */
export function unmetFor(
  person: any,
  requirements: ResolvedRequirement[],
  ctx?: { catalogue?: PersonFieldDef[]; asOf?: Date },
): Unmet[] {
  const labelOf = (key: string) => ctx?.catalogue?.find(f => f.key === key)?.label ?? key
  const known = ctx?.catalogue ? new Set(ctx.catalogue.map(f => f.key)) : null
  const out: Unmet[] = []
  for (const req of requirements) {
    if (known && !known.has(req.field_key)) continue          // broken, not unmet
    const ok = testRequirement(person, req, ctx?.catalogue, ctx?.asOf)
    if (ok === true) continue
    const fieldLabel = labelOf(req.field_key)
    const reason: Unmet['reason'] = ok === null ? 'unknown' : req.operator === 'Is Not Empty' ? 'missing' : 'mismatch'
    // Say the one thing that's wrong. The surface already gives the context — the
    // roster band names the discipline — so repeating it here ("Doesn't match GRADE
    // A — level of player must be Grade A there") just made every line a sentence
    // you had to read twice. The rule reads as itself: "Gender must be MALE".
    const fallback = reason === 'unknown'
      ? req.field_key === AGE_FIELD_KEY
        ? `No date of birth — can't check their age`
        : `No ${fieldLabel.toLowerCase()} recorded — can't check it`
      : `${fieldLabel} ${describeRequirement(req)}`
    out.push({
      requirement: req,
      fieldKey: req.field_key,
      fieldLabel,
      disciplineId: req.viaDisciplineId,
      disciplineName: req.viaDisciplineName,
      reason,
      message: req.message || fallback,
    })
  }
  return out
}

/** Requirements pointing at a field the catalogue doesn't know. Admin-facing only. */
export function brokenIn(requirements: ResolvedRequirement[], catalogue: PersonFieldDef[]): Broken[] {
  const known = new Set(catalogue.map(f => f.key))
  return requirements.filter(r => !known.has(r.field_key)).map(r => ({ requirement: r, reason: 'field-not-in-catalogue' as const }))
}

// NB there is deliberately NO discipline "resolution"/derivation step. Age used to
// be a band on the discipline that SELECTED which child a person fell into, so a
// class could link to plain "Football" and sort juniors from seniors by DOB. That
// bought one convenience and cost a pile of machinery — overlapping-band
// tie-breaks, out-of-band fallback, recursion, and a second inheritance rule that
// behaved unlike requirements two inches away on the same screen. Age is now an
// ordinary requirement ("Age Is At Most 15"), and a class links to the SPECIFIC
// discipline it belongs to. The disciplines a group/event is linked to ARE its
// disciplines; each one's chain is resolved and its requirements evaluated.

// ── The editor-facing view ──────────────────────────────────────────────────
export type ReqEntryState = 'own' | 'inherited' | 'overridden' | 'cancelled'
export interface ReqEntry {
  field_key: string
  state: ReqEntryState
  rows: ResolvedRequirement[]                                   // the winning rows (may be exempt)
  source: { disciplineId: string; disciplineName: string }
  shadowed: ResolvedRequirement[]
}

/**
 * One entry per field_key, closest-wins resolved — so the editor's list IS the
 * effective set. The editor and the evaluator must resolve through the same code
 * or the editor lies about what it's enforcing.
 *
 * Unfiltered by person type on purpose: this is the "show me everything this
 * discipline demands" view.
 */
export function resolveFor(
  disciplineId: string,
  allDisciplines: DisciplineNode[],
  allRequirements: DisciplineRequirement[],
): ReqEntry[] {
  const chain = disciplineChain(disciplineId, allDisciplines)
  if (!chain.length) return []
  const depthOf = new Map(chain.map((d, i) => [d.id, i]))

  const byField = new Map<string, DisciplineRequirement[]>()
  for (const r of allRequirements) {
    if (!depthOf.has(r.discipline_id)) continue
    const list = byField.get(r.field_key) ?? []
    list.push(r)
    byField.set(r.field_key, list)
  }

  const entries: ReqEntry[] = []
  for (const [field_key, rows] of byField) {
    const winDepth = Math.min(...rows.map(r => depthOf.get(r.discipline_id)!))
    const winner = chain[winDepth]
    let winning = rows.filter(r => depthOf.get(r.discipline_id) === winDepth)
    if (winning.some(r => !r.exempt)) winning = winning.filter(r => !r.exempt)
    const older = rows.filter(r => depthOf.get(r.discipline_id) !== winDepth)

    const resolve = (r: DisciplineRequirement): ResolvedRequirement => {
      const via = chain[depthOf.get(r.discipline_id)!]
      return { ...r, viaDisciplineId: via.id, viaDisciplineName: via.name, depth: depthOf.get(r.discipline_id)! }
    }

    const ownWins = winDepth === 0
    const state: ReqEntryState = !ownWins ? 'inherited'
      : winning.every(r => r.exempt) ? 'cancelled'
      : older.length ? 'overridden'
      : 'own'

    entries.push({
      field_key,
      state,
      rows: winning.map(resolve),
      source: { disciplineId: winner.id, disciplineName: winner.name },
      shadowed: older.map(r => ({ ...resolve(r), shadowedBy: { disciplineId: winner.id, disciplineName: winner.name, depth: winDepth } })),
    })
  }
  return entries.sort((a, b) => (a.rows[0]?.sort_order ?? 0) - (b.rows[0]?.sort_order ?? 0) || a.field_key.localeCompare(b.field_key))
}

// ── DB factory ──────────────────────────────────────────────────────────────
// (The seam maps the two-column field split; the factory's own toReq/toCreate
// helpers do the camelCase ↔ this-file-shape translation.)
export function useDisciplineRequirements() {
  // Data access goes through the seam (useDisciplinesApi). Everything the pages read
  // is this composable's snake_case shape, so map the camelCase contract at the edge.
  const api = useDisciplinesApi()

  // Seam Discipline (contract) → this composable's DisciplineNode. An empty cast
  // becomes null so castFor reads it as "inherit" (the whole point of person_type_keys).
  function toNode(d: any): DisciplineNode {
    return {
      id: d.id,
      name: d.name,
      parent_id: d.parentId ?? null,
      sort_order: d.sortOrder ?? 0,
      person_type_keys: Array.isArray(d.personTypeKeys) && d.personTypeKeys.length ? d.personTypeKeys : null,
    }
  }
  // Seam DisciplineRequirement (contract) → this composable's shape. field_key is the
  // single key the catalogue uses; field_source is DERIVED from which column is set.
  function toReq(r: any): DisciplineRequirement {
    return {
      id: r.id,
      discipline_id: r.disciplineId,
      field_key: r.fieldKey ?? r.fieldDefinitionId ?? r.fieldColumn ?? '',
      field_source: r.fieldDefinitionId ? 'custom' : 'core',
      purpose: r.purpose === 'identity' ? 'identity' : 'data',
      operator: r.operator,
      value: r.value,
      exempt: !!r.exempt,
      applies_to: Array.isArray(r.appliesTo) ? r.appliesTo : [],
      message: r.message ?? null,
      sort_order: r.sortOrder ?? 0,
    }
  }
  // This composable's requirement → the seam's create payload. The two-column field
  // split (the ONLY place it's visible) lives here now.
  function toCreate(r: Partial<DisciplineRequirement>, i: number) {
    const custom = r.field_source === 'custom'
    return {
      fieldColumn: custom ? null : (r.field_key ?? null),
      fieldDefinitionId: custom ? (r.field_key ?? null) : null,
      fieldKey: r.field_key ?? null,
      purpose: r.purpose ?? 'data',
      operator: r.operator as string,
      value: r.value ?? null,
      exempt: r.exempt ?? false,
      appliesTo: r.applies_to ?? [],
      message: r.message ?? null,
      sortOrder: r.sort_order ?? i,
    }
  }

  /**
   * Requirements for a set of disciplines. Pass the CHAIN ids (see disciplineChain)
   * or every discipline id and let effectiveRequirements do the walking.
   *
   * NB requirements are authored by the NSO that owns the discipline, so this is
   * keyed by discipline_id ONLY — never filter it by the caller's own org, or it
   * returns nothing in every club with no error.
   */
  async function loadRequirements(disciplineIds: string[]): Promise<DisciplineRequirement[]> {
    if (!disciplineIds.length) return []
    const rows = await api.requirements(disciplineIds)
    return rows.map(toReq)
  }

  /** Every discipline owned by these orgs — UNFILTERED, because the chain walk needs ancestors. */
  async function loadDisciplines(orgIds: string[]): Promise<DisciplineNode[]> {
    if (!orgIds.length) return []
    const rows = await api.listForOrgs(orgIds)
    return rows.map(toNode)
  }

  /** The disciplines a group/event is linked to, plus every requirement in their chains. */
  async function loadForEntity(kind: 'event' | 'group', id: string): Promise<{ disciplines: DisciplineNode[]; linkedIds: string[]; requirements: DisciplineRequirement[] }> {
    const linked = kind === 'group' ? await api.forGroup(id) : await api.forEvent(id)
    const linkedIds = linked.map((l) => l.id).filter(Boolean)
    if (!linkedIds.length) return { disciplines: [], linkedIds: [], requirements: [] }
    const orgIds = [...new Set(linked.map((l) => l.orgId).filter(Boolean))] as string[]
    const disciplines = await loadDisciplines(orgIds)
    const requirements = await loadRequirements(disciplines.map(d => d.id))
    return { disciplines, linkedIds, requirements }
  }

  async function saveRequirements(disciplineId: string, reqs: Partial<DisciplineRequirement>[]): Promise<void> {
    // Delete-then-insert, scoped to the discipline — the seam replaces the whole set.
    await api.saveRequirements(disciplineId, reqs.map(toCreate) as any)
  }

  async function deleteRequirement(id: string): Promise<void> {
    await api.deleteRequirement(id)
  }

  /** Convenience for the flag surfaces: person + entity → what they fail. */
  async function flagsForPerson(
    person: any,
    entity: { type: 'event' | 'group'; id: string },
    ctx?: { catalogue?: PersonFieldDef[]; asOf?: Date },
  ): Promise<{ unmet: Unmet[]; broken: Broken[] }> {
    const { disciplines, linkedIds, requirements } = await loadForEntity(entity.type, entity.id)
    if (!linkedIds.length) return { unmet: [], broken: [] }
    // The linked disciplines ARE the disciplines — no derivation. Each one's chain
    // is resolved independently and the results unioned.
    const { effective } = effectiveRequirementsForMany(linkedIds, disciplines, requirements, {
      personTypeKeys: personTypeKeysOf(person),
    })
    return {
      unmet: unmetFor(person, effective, { catalogue: ctx?.catalogue, asOf: ctx?.asOf }),
      broken: ctx?.catalogue ? brokenIn(effective, ctx.catalogue) : [],
    }
  }

  return { loadRequirements, loadDisciplines, loadForEntity, saveRequirements, deleteRequirement, flagsForPerson }
}
