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

// The editor's single dropdown. "Not required" is a LABEL for exempt — never a
// stored operator, which would diverge this vocabulary from visibility_conditions.
export const REQUIREMENT_OPTIONS: { label: string; exempt: boolean; operator: ReqOperator | null }[] = [
  { label: 'Not required', exempt: true, operator: null },
  ...REQUIREMENT_OPERATORS.map(o => ({ label: o as string, exempt: false, operator: o })),
]

// ── Types ───────────────────────────────────────────────────────────────────
export interface DisciplineRequirement {
  id: string
  discipline_id: string
  field_key: string                 // core column name | field_definitions.id
  field_source: 'core' | 'custom'
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

/** Human phrasing for one requirement row — used by the editor and the flags. */
export function describeRequirement(r: Pick<DisciplineRequirement, 'operator' | 'value' | 'exempt'>): string {
  if (r.exempt) return 'Not required'
  if (VALUELESS_OPERATORS.includes(r.operator)) return r.operator
  if (r.operator === 'Is Between') {
    const [lo, hi] = Array.isArray(r.value) ? r.value : [null, null]
    return `Is between ${lo ?? '—'} and ${hi ?? '—'}`
  }
  return `${r.operator} ${r.value ?? ''}`.trim()
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
    const fallback = reason === 'unknown'
      ? req.field_key === AGE_FIELD_KEY
        ? `Date of birth isn't recorded, so we can't check the age ${req.viaDisciplineName} requires`
        : `${fieldLabel} isn't recorded, so we can't check what ${req.viaDisciplineName} requires`
      : reason === 'missing'
        ? `${fieldLabel} is required by ${req.viaDisciplineName}`
        : `${fieldLabel} must be ${describeRequirement(req).replace(/^Is /, '').toLowerCase()} for ${req.viaDisciplineName}`
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
const COLS = 'id, discipline_id, field_column, field_definition_id, field_key, operator, value, exempt, applies_to, message, sort_order'

function rowToReq(r: any): DisciplineRequirement {
  return {
    id: r.id,
    discipline_id: r.discipline_id,
    field_key: r.field_key ?? r.field_definition_id ?? r.field_column,
    field_source: r.field_definition_id ? 'custom' : 'core',
    operator: r.operator,
    value: r.value,
    exempt: !!r.exempt,
    applies_to: Array.isArray(r.applies_to) ? r.applies_to : [],
    message: r.message ?? null,
    sort_order: r.sort_order ?? 0,
  }
}

/** The ONLY place the two-column field split is visible. */
function reqToRow(req: Partial<DisciplineRequirement>) {
  const { field_key, field_source, ...rest } = req as any
  const split = field_key === undefined ? {} : field_source === 'custom'
    ? { field_column: null, field_definition_id: field_key }
    : { field_column: field_key, field_definition_id: null }
  return { ...rest, ...split }
}

export function useDisciplineRequirements() {
  const db = useDb()

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
    const { data } = await (db.from as any)('discipline_requirements')
      .select(COLS).in('discipline_id', disciplineIds).order('sort_order')
    return (data ?? []).map(rowToReq)
  }

  /** Every discipline owned by these orgs — UNFILTERED, because the chain walk needs ancestors. */
  async function loadDisciplines(orgIds: string[]): Promise<DisciplineNode[]> {
    if (!orgIds.length) return []
    const { data } = await (db.from as any)('disciplines')
      .select('id, name, parent_id, sort_order').in('org_id', orgIds).order('sort_order').order('name')
    return (data ?? []).map((d: any) => ({ id: d.id, name: d.name, parent_id: d.parent_id ?? null, sort_order: d.sort_order ?? 0 }))
  }

  /** The disciplines a group/event is linked to, plus every requirement in their chains. */
  async function loadForEntity(kind: 'event' | 'group', id: string): Promise<{ disciplines: DisciplineNode[]; linkedIds: string[]; requirements: DisciplineRequirement[] }> {
    const table = kind === 'group' ? 'member_group_disciplines' : 'event_disciplines'
    const fk = kind === 'group' ? 'group_id' : 'event_id'
    const { data: links } = await (db.from as any)(table)
      .select('discipline_id, disciplines(org_id)').eq(fk, id)
    const linkedIds = (links ?? []).map((l: any) => l.discipline_id).filter(Boolean)
    if (!linkedIds.length) return { disciplines: [], linkedIds: [], requirements: [] }
    const orgIds = [...new Set((links ?? []).map((l: any) => l.disciplines?.org_id).filter(Boolean))] as string[]
    const disciplines = await loadDisciplines(orgIds)
    const requirements = await loadRequirements(disciplines.map(d => d.id))
    return { disciplines, linkedIds, requirements }
  }

  async function saveRequirements(disciplineId: string, reqs: Partial<DisciplineRequirement>[]): Promise<void> {
    // Delete-then-insert, scoped to the discipline — the DisciplineLinker idiom.
    await (db.from as any)('discipline_requirements').delete().eq('discipline_id', disciplineId)
    if (!reqs.length) return
    const rows = reqs.map((r, i) => reqToRow({ ...r, discipline_id: disciplineId, sort_order: i }))
    await (db.from as any)('discipline_requirements').insert(rows)
  }

  async function deleteRequirement(id: string): Promise<void> {
    await (db.from as any)('discipline_requirements').delete().eq('id', id)
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
