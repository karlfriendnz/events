import { describe, it, expect } from 'vitest'
import {
  disciplineChain, effectiveRequirements, effectiveRequirementsForMany, resolveDisciplinesFor,
  resolveFor, testRequirement, unmetFor, brokenIn, personValueFor, requirementApplies,
  ageBandLabel, REQUIREMENT_OPERATORS, REQUIREMENT_OPTIONS,
  type DisciplineNode, type DisciplineRequirement,
} from '../../composables/useDisciplineRequirements'
import { ageFromDob } from '../../composables/useAge'
import type { PersonFieldDef } from '../../composables/usePersonFields'

// The worked example the whole model exists for:
//   Football          → Job Is Not Empty
//   ├─ Junior Football (age_max 15) → School Is Not Empty · Job EXEMPT
//   └─ Senior Football (age_min 16) → (inherits Job)
const FOOTBALL: DisciplineNode = { id: 'fb', name: 'Football', parent_id: null, age_min: null, age_max: null, sort_order: 0 }
const JUNIOR: DisciplineNode = { id: 'jr', name: 'Junior Football', parent_id: 'fb', age_min: null, age_max: 15, sort_order: 0 }
const SENIOR: DisciplineNode = { id: 'sr', name: 'Senior Football', parent_id: 'fb', age_min: 16, age_max: null, sort_order: 1 }
const TREE = [FOOTBALL, JUNIOR, SENIOR]

const SCHOOL_ID = '11111111-1111-1111-1111-111111111111'
const JOB_ID = '22222222-2222-2222-2222-222222222222'
const TOP_ID = '33333333-3333-3333-3333-333333333333'

const req = (p: Partial<DisciplineRequirement>): DisciplineRequirement => ({
  id: Math.random().toString(36).slice(2), discipline_id: 'fb', field_key: SCHOOL_ID, field_source: 'custom',
  operator: 'Is Not Empty', value: null, exempt: false, applies_to: [], message: null, sort_order: 0, ...p,
})

const REQS: DisciplineRequirement[] = [
  req({ id: 'fb-job', discipline_id: 'fb', field_key: JOB_ID, operator: 'Is Not Empty' }),
  req({ id: 'jr-school', discipline_id: 'jr', field_key: SCHOOL_ID, operator: 'Is Not Empty' }),
  req({ id: 'jr-job-exempt', discipline_id: 'jr', field_key: JOB_ID, exempt: true, message: 'Juniors are exempt' }),
]

const CATALOGUE: PersonFieldDef[] = [
  { key: 'dob', label: 'Date of birth', source: 'core', field_type: 'date' },
  { key: 'gender', label: 'Gender', source: 'core', field_type: 'text' },
  { key: SCHOOL_ID, label: 'School', source: 'custom', field_type: 'text' },
  { key: JOB_ID, label: 'Job', source: 'custom', field_type: 'text' },
  { key: TOP_ID, label: 'Top colour', source: 'custom', field_type: 'select', options: ['Blue', 'Red'] },
]

const keysOf = (rs: { field_key: string }[]) => rs.map(r => r.field_key).sort()

describe('vocabulary', () => {
  it('matches visibility_conditions exactly — no extra stored operator', () => {
    expect(REQUIREMENT_OPERATORS).toEqual(['Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty'])
  })
  it('offers "Not required" as a label for exempt, never as an operator', () => {
    const notRequired = REQUIREMENT_OPTIONS[0]
    expect(notRequired).toEqual({ label: 'Not required', exempt: true, operator: null })
    expect(REQUIREMENT_OPERATORS).not.toContain('Not required' as any)
  })
})

describe('ageBandLabel', () => {
  it('phrases every band shape', () => {
    expect(ageBandLabel(5, 15)).toBe('Ages 5–15')
    expect(ageBandLabel(16, null)).toBe('Ages 16+')
    expect(ageBandLabel(null, 15)).toBe('Up to age 15')
    expect(ageBandLabel(null, null)).toBeNull()
  })
})

describe('disciplineChain', () => {
  it('walks child → root', () => {
    expect(disciplineChain('jr', TREE).map(d => d.id)).toEqual(['jr', 'fb'])
  })
  it('terminates on a cycle rather than hanging', () => {
    const a: DisciplineNode = { id: 'a', name: 'A', parent_id: 'b', age_min: null, age_max: null }
    const b: DisciplineNode = { id: 'b', name: 'B', parent_id: 'a', age_min: null, age_max: null }
    expect(disciplineChain('a', [a, b]).map(d => d.id)).toEqual(['a', 'b'])
  })
  it('treats a parent missing from the array as root', () => {
    expect(disciplineChain('jr', [JUNIOR]).map(d => d.id)).toEqual(['jr'])
  })
})

describe('effectiveRequirements — closest-wins', () => {
  it('inherits an ancestor rule when the child says nothing about that field', () => {
    const { effective } = effectiveRequirements('sr', TREE, REQS)
    expect(keysOf(effective)).toEqual([JOB_ID])
    expect(effective[0].viaDisciplineName).toBe('Football')
    expect(effective[0].depth).toBe(1)
  })

  it('an exempt row shadows the ancestor and contributes no test', () => {
    const { effective, shadowed } = effectiveRequirements('jr', TREE, REQS)
    expect(keysOf(effective)).toEqual([SCHOOL_ID])          // Job is cancelled
    expect(shadowed.map(r => r.id)).toEqual(['fb-job'])
    expect(shadowed[0].shadowedBy?.disciplineName).toBe('Junior Football')
  })

  it('a child rule replaces the whole ancestor group for that field', () => {
    const reqs = [
      req({ id: 'fb-a', discipline_id: 'fb', field_key: SCHOOL_ID, operator: 'Is Not Empty' }),
      req({ id: 'fb-b', discipline_id: 'fb', field_key: SCHOOL_ID, operator: 'Contains', value: 'Primary' }),
      req({ id: 'jr-a', discipline_id: 'jr', field_key: SCHOOL_ID, operator: 'Equals', value: 'Local Primary' }),
    ]
    const { effective, shadowed } = effectiveRequirements('jr', TREE, reqs)
    expect(effective.map(r => r.id)).toEqual(['jr-a'])
    expect(shadowed.map(r => r.id).sort()).toEqual(['fb-a', 'fb-b'])
  })

  it('skips levels — the closest ancestor WITH rows wins', () => {
    const u12: DisciplineNode = { id: 'u12', name: 'U12', parent_id: 'jr', age_min: null, age_max: 11 }
    const reqs = [req({ id: 'fb-s', discipline_id: 'fb', field_key: SCHOOL_ID }), req({ id: 'u12-s', discipline_id: 'u12', field_key: SCHOOL_ID, operator: 'Equals', value: 'X' })]
    const { effective, shadowed } = effectiveRequirements('u12', [...TREE, u12], reqs)
    expect(effective.map(r => r.id)).toEqual(['u12-s'])     // Junior has no School rows — skipped
    expect(shadowed.map(r => r.id)).toEqual(['fb-s'])
  })

  it('a real rule beats a contradictory exempt row at the SAME level', () => {
    const reqs = [
      req({ id: 'jr-x', discipline_id: 'jr', field_key: SCHOOL_ID, exempt: true }),
      req({ id: 'jr-y', discipline_id: 'jr', field_key: SCHOOL_ID, operator: 'Is Not Empty' }),
    ]
    const { effective } = effectiveRequirements('jr', TREE, reqs)
    expect(effective.map(r => r.id)).toEqual(['jr-y'])      // a rule that fires is visible and fixable
  })

  // The correctness bug caught in review: without the person-type PRE-filter, a
  // coach-scoped child row shadows a member-scoped parent row and MEMBERS SILENTLY
  // LOSE the requirement.
  it('a coach-scoped child row does NOT shadow a member-scoped parent row', () => {
    const reqs = [
      req({ id: 'fb-member', discipline_id: 'fb', field_key: SCHOOL_ID, applies_to: ['member'], operator: 'Is Not Empty' }),
      req({ id: 'jr-coach', discipline_id: 'jr', field_key: SCHOOL_ID, applies_to: ['coach'], operator: 'Equals', value: 'Local Primary' }),
    ]
    const asMember = effectiveRequirements('jr', TREE, reqs, { personTypeKeys: ['member'] })
    expect(asMember.effective.map(r => r.id)).toEqual(['fb-member'])   // ← the member keeps it
    const asCoach = effectiveRequirements('jr', TREE, reqs, { personTypeKeys: ['coach'] })
    expect(asCoach.effective.map(r => r.id)).toEqual(['jr-coach'])
  })

  it('unfiltered (the admin view) sees the collision', () => {
    const reqs = [
      req({ id: 'fb-member', discipline_id: 'fb', field_key: SCHOOL_ID, applies_to: ['member'] }),
      req({ id: 'jr-coach', discipline_id: 'jr', field_key: SCHOOL_ID, applies_to: ['coach'] }),
    ]
    const { effective, shadowed } = effectiveRequirements('jr', TREE, reqs)
    expect(effective.map(r => r.id)).toEqual(['jr-coach'])
    expect(shadowed.map(r => r.id)).toEqual(['fb-member'])
  })
})

describe('effectiveRequirementsForMany — closest-wins is per-chain', () => {
  it('a rule from one NSO does not shadow another NSO rule on the same field', () => {
    const cricket: DisciplineNode = { id: 'ck', name: 'Cricket NZ Seniors', parent_id: null, age_min: null, age_max: null }
    const reqs = [
      req({ id: 'fb-school', discipline_id: 'fb', field_key: SCHOOL_ID, operator: 'Is Not Empty' }),
      req({ id: 'ck-school', discipline_id: 'ck', field_key: SCHOOL_ID, operator: 'Equals', value: 'X' }),
    ]
    const { effective } = effectiveRequirementsForMany(['fb', 'ck'], [...TREE, cricket], reqs)
    expect(effective.map(r => r.id).sort()).toEqual(['ck-school', 'fb-school'])   // both authorities apply
  })
})

describe('resolveDisciplinesFor', () => {
  const at = new Date('2026-07-17T00:00:00Z')
  const aged = (years: number) => ({ dob: `${at.getFullYear() - years}-01-01` })

  it('picks the child whose band contains the person', () => {
    expect(resolveDisciplinesFor(aged(12), ['fb'], TREE, at).resolvedIds).toEqual(['jr'])
    expect(resolveDisciplinesFor(aged(30), ['fb'], TREE, at).resolvedIds).toEqual(['sr'])
  })
  it('uses the discipline as linked when it has no banded children', () => {
    const r = resolveDisciplinesFor(aged(12), ['jr'], TREE, at)
    expect(r.resolvedIds).toEqual(['jr'])
    expect(r.matched[0].via).toBe('direct')
  })
  it('never guesses without a dob — stays put and says so', () => {
    const r = resolveDisciplinesFor({ dob: null }, ['fb'], TREE, at)
    expect(r.resolvedIds).toEqual(['fb'])
    expect(r.notes).toEqual([{ kind: 'no-dob', linkedId: 'fb' }])
  })
  it('does not snap an out-of-band person to the nearest band', () => {
    const kid: DisciplineNode = { id: 'k', name: 'Kids', parent_id: 'fb', age_min: 5, age_max: 10 }
    const r = resolveDisciplinesFor(aged(30), ['fb'], [FOOTBALL, kid], at)
    expect(r.resolvedIds).toEqual(['fb'])
    expect(r.notes[0]).toMatchObject({ kind: 'out-of-band', age: 30 })
  })
  it('picks the narrowest band on an overlap, deterministically', () => {
    const juniors: DisciplineNode = { id: 'j2', name: 'Juniors', parent_id: 'fb', age_min: 5, age_max: 17, sort_order: 0 }
    const u12: DisciplineNode = { id: 'u12', name: 'U12', parent_id: 'fb', age_min: 5, age_max: 11, sort_order: 1 }
    const r = resolveDisciplinesFor(aged(10), ['fb'], [FOOTBALL, juniors, u12], at)
    expect(r.resolvedIds).toEqual(['u12'])
    expect(r.notes[0]).toMatchObject({ kind: 'ambiguous', chosenId: 'u12' })
  })
  it('recurses two levels', () => {
    const u12: DisciplineNode = { id: 'u12', name: 'U12', parent_id: 'jr', age_min: null, age_max: 11 }
    expect(resolveDisciplinesFor(aged(10), ['fb'], [...TREE, u12], at).resolvedIds).toEqual(['u12'])
  })
  it('dedupes when two links resolve to the same discipline', () => {
    expect(resolveDisciplinesFor(aged(12), ['fb', 'jr'], TREE, at).resolvedIds).toEqual(['jr'])
  })
})

describe('testRequirement / unmetFor', () => {
  const person = (p: any) => ({ person_types: ['member'], custom_fields: {}, ...p })

  it('reads core by column and custom by field id', () => {
    expect(personValueFor({ gender: 'FEMALE' }, { field_key: 'gender', field_source: 'core' })).toBe('FEMALE')
    expect(personValueFor({ custom_fields: { [SCHOOL_ID]: 'X' } }, { field_key: SCHOOL_ID, field_source: 'custom' })).toBe('X')
  })

  it('Equals is case/trim-insensitive — stored FEMALE vs authored "Female"', () => {
    const r = req({ field_key: 'gender', field_source: 'core', operator: 'Equals', value: 'Female' })
    expect(testRequirement(person({ gender: 'FEMALE' }), r)).toBe(true)
    expect(testRequirement(person({ gender: 'MALE' }), r)).toBe(false)
  })

  it('is array-aware for multi-select fields', () => {
    const r = req({ field_key: TOP_ID, operator: 'Equals', value: 'Blue' })
    expect(testRequirement(person({ custom_fields: { [TOP_ID]: ['Red', 'Blue'] } }), r)).toBe(true)
    expect(testRequirement(person({ custom_fields: { [TOP_ID]: ['Red'] } }), r)).toBe(false)
  })

  it('"Is Not" PASSES on a blank value — locked in deliberately', () => {
    const r = req({ field_key: SCHOOL_ID, operator: 'Is Not', value: 'Home schooled' })
    expect(testRequirement(person({}), r)).toBe(true)   // presence is a separate test
  })

  it('an exempt row never fails', () => {
    expect(testRequirement(person({}), req({ exempt: true }))).toBe(true)
  })

  it('a field missing from the catalogue is BROKEN, never a person flag', () => {
    const gone = req({ id: 'ghost', field_key: 'deleted-field-id' })
    expect(testRequirement(person({}), gone, CATALOGUE)).toBeNull()
    const { effective } = effectiveRequirements('jr', TREE, [{ ...gone, discipline_id: 'jr' }])
    expect(unmetFor(person({}), effective, { catalogue: CATALOGUE })).toEqual([])
    expect(brokenIn(effective, CATALOGUE).map(b => b.requirement.id)).toEqual(['ghost'])
  })

  it('generates a message naming the field and the discipline, and honours a custom one', () => {
    const { effective } = effectiveRequirements('jr', TREE, REQS)
    const [u] = unmetFor(person({}), effective, { catalogue: CATALOGUE })
    expect(u.message).toBe('School is required by Junior Football')
    expect(u.reason).toBe('missing')

    const custom = effectiveRequirements('jr', TREE, [req({ discipline_id: 'jr', field_key: SCHOOL_ID, message: 'We need their school' })])
    expect(unmetFor(person({}), custom.effective, { catalogue: CATALOGUE })[0].message).toBe('We need their school')
  })
})

describe('requirementApplies', () => {
  it('defers to the field targets when the requirement names no types', () => {
    expect(requirementApplies({ applies_to: [] }, ['coach'], ['member'])).toBe(false)
    expect(requirementApplies({ applies_to: [] }, ['member'], ['member'])).toBe(true)
    expect(requirementApplies({ applies_to: [] }, ['anyone'], undefined)).toBe(true)
  })
  it('its own types win over the field targets', () => {
    expect(requirementApplies({ applies_to: ['coach'] }, ['coach'], ['member'])).toBe(true)
  })
})

describe('resolveFor — the editor view', () => {
  it('labels each field entry with its state', () => {
    const byKey = Object.fromEntries(resolveFor('jr', TREE, REQS).map(e => [e.field_key, e]))
    expect(byKey[SCHOOL_ID].state).toBe('own')
    expect(byKey[JOB_ID].state).toBe('cancelled')
    expect(byKey[JOB_ID].shadowed.map(r => r.id)).toEqual(['fb-job'])
  })
  it('an untouched child shows its ancestors rules as inherited', () => {
    const entries = resolveFor('sr', TREE, REQS)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ field_key: JOB_ID, state: 'inherited' })
    expect(entries[0].source.disciplineName).toBe('Football')
  })
  it('marks a genuine override and keeps what it replaced', () => {
    const reqs = [...REQS, req({ id: 'jr-job-real', discipline_id: 'jr', field_key: JOB_ID, operator: 'Equals', value: 'Student' })]
    const entry = resolveFor('jr', TREE, reqs).find(e => e.field_key === JOB_ID)!
    expect(entry.state).toBe('overridden')
    expect(entry.rows.map(r => r.id)).toEqual(['jr-job-real'])   // the exempt row loses to the real one
    expect(entry.shadowed.map(r => r.id)).toEqual(['fb-job'])
  })
})

describe('ageFromDob', () => {
  it('ages at a reference date, not just today', () => {
    expect(ageFromDob('2010-01-01', new Date('2026-07-17'))).toBe(16)
    expect(ageFromDob('2010-01-01', new Date('2020-07-17'))).toBe(10)
  })
  it('handles the birthday boundary', () => {
    expect(ageFromDob('2010-07-17', new Date('2026-07-16'))).toBe(15)
    expect(ageFromDob('2010-07-17', new Date('2026-07-17'))).toBe(16)
  })
  it('reports nothing rather than a confident lie', () => {
    expect(ageFromDob(null)).toBeNull()
    expect(ageFromDob('not a date')).toBeNull()
    expect(ageFromDob('1700-01-01', new Date('2026-07-17'))).toBeNull()   // 326 → clamped
    expect(ageFromDob('2030-01-01', new Date('2026-07-17'))).toBeNull()   // future
  })
  it('takes a string or a Date', () => {
    expect(ageFromDob(new Date('2010-01-01'), new Date('2026-07-17'))).toBe(16)
  })
})

// The acceptance criterion, in the user's own words:
// "if I am a junior footballer I require my school ... but if I'm a senior player
//  then I require my job ... a junior is anyone under 16"
describe('the whole point', () => {
  const at = new Date('2026-07-17T00:00:00Z')
  const footballer = (age: number, fields: Record<string, any> = {}) => ({
    person_types: ['member'], dob: `${at.getFullYear() - age}-01-01`, custom_fields: fields,
  })
  const flags = (person: any) => {
    const res = resolveDisciplinesFor(person, ['fb'], TREE, at)
    const { effective } = effectiveRequirementsForMany(res.resolvedIds, TREE, REQS, { personTypeKeys: ['member'] })
    return unmetFor(person, effective, { catalogue: CATALOGUE }).map(u => u.fieldLabel)
  }

  it('a 12-year-old needs their school, not their job', () => {
    expect(flags(footballer(12))).toEqual(['School'])
    expect(flags(footballer(12, { [SCHOOL_ID]: 'Local Primary' }))).toEqual([])
  })

  it('a 30-year-old needs their job, not their school', () => {
    expect(flags(footballer(30))).toEqual(['Job'])
    expect(flags(footballer(30, { [JOB_ID]: 'Builder' }))).toEqual([])
  })

  it('16 is the boundary — "a junior is anyone under 16"', () => {
    expect(flags(footballer(15))).toEqual(['School'])
    expect(flags(footballer(16))).toEqual(['Job'])
  })
})
