import { describe, it, expect } from 'vitest'
import {
  disciplineChain, effectiveRequirements, effectiveRequirementsForMany,
  resolveFor, testRequirement, unmetFor, brokenIn, personValueFor, requirementApplies,
  describeRequirement, AGE_FIELD_KEY, REQUIREMENT_OPERATORS, SHARED_OPERATORS, REQUIREMENT_OPTIONS,
  type DisciplineNode, type DisciplineRequirement,
} from '../../composables/useDisciplineRequirements'
import { ageFromDob } from '../../composables/useAge'
import type { PersonFieldDef } from '../../composables/usePersonFields'

// The worked example the whole model exists for. Age is an ORDINARY requirement —
// there is no age band and no derivation:
//   Football          → Job Is Not Empty
//   ├─ Junior Football → Age Is At Most 15 · School Is Not Empty · Job EXEMPT
//   └─ Senior Football → Age Is At Least 16 (inherits Job)
const FOOTBALL: DisciplineNode = { id: 'fb', name: 'Football', parent_id: null, sort_order: 0 }
const JUNIOR: DisciplineNode = { id: 'jr', name: 'Junior Football', parent_id: 'fb', sort_order: 0 }
const SENIOR: DisciplineNode = { id: 'sr', name: 'Senior Football', parent_id: 'fb', sort_order: 1 }
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
  { key: 'age', label: 'Age', source: 'core', field_type: 'number' },
  { key: SCHOOL_ID, label: 'School', source: 'custom', field_type: 'text' },
  { key: JOB_ID, label: 'Job', source: 'custom', field_type: 'text' },
  { key: TOP_ID, label: 'Top colour', source: 'custom', field_type: 'select', options: ['Blue', 'Red'] },
]

const keysOf = (rs: { field_key: string }[]) => rs.map(r => r.field_key).sort()

describe('vocabulary', () => {
  // The shared five must stay byte-identical to FormFieldAdvancedEditor's list.
  it('shares exactly the visibility_conditions five', () => {
    expect(SHARED_OPERATORS).toEqual(['Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty'])
  })
  // The numeric three are a DELIBERATE superset: condPasses tests form answers by
  // label; a requirement tests stored person data including a computed age.
  it('adds numeric operators on top, and nothing else', () => {
    expect(REQUIREMENT_OPERATORS).toEqual([...SHARED_OPERATORS, 'Is At Least', 'Is At Most', 'Is Between'])
  })
  it('offers "Not required" as a label for exempt, never as an operator', () => {
    expect(REQUIREMENT_OPTIONS[0]).toEqual({ label: 'Not required', exempt: true, operator: null })
    expect(REQUIREMENT_OPERATORS).not.toContain('Not required' as any)
  })
})

describe('describeRequirement', () => {
  it('phrases every row shape', () => {
    expect(describeRequirement({ operator: 'Is At Most', value: 15, exempt: false })).toBe('Is At Most 15')
    expect(describeRequirement({ operator: 'Is Between', value: [5, 15], exempt: false })).toBe('Is between 5 and 15')
    expect(describeRequirement({ operator: 'Is Not Empty', value: null, exempt: false })).toBe('Is Not Empty')
    expect(describeRequirement({ operator: 'Equals', value: 'Blue', exempt: false })).toBe('Equals Blue')
    expect(describeRequirement({ operator: 'Equals', value: 'Blue', exempt: true })).toBe('Not required')
  })
})

describe('disciplineChain', () => {
  it('walks child → root', () => {
    expect(disciplineChain('jr', TREE).map(d => d.id)).toEqual(['jr', 'fb'])
  })
  it('terminates on a cycle rather than hanging', () => {
    const a: DisciplineNode = { id: 'a', name: 'A', parent_id: 'b' }
    const b: DisciplineNode = { id: 'b', name: 'B', parent_id: 'a' }
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
    const u12: DisciplineNode = { id: 'u12', name: 'U12', parent_id: 'jr' }
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
    const cricket: DisciplineNode = { id: 'ck', name: 'Cricket NZ Seniors', parent_id: null }
    const reqs = [
      req({ id: 'fb-school', discipline_id: 'fb', field_key: SCHOOL_ID, operator: 'Is Not Empty' }),
      req({ id: 'ck-school', discipline_id: 'ck', field_key: SCHOOL_ID, operator: 'Equals', value: 'X' }),
    ]
    const { effective } = effectiveRequirementsForMany(['fb', 'ck'], [...TREE, cricket], reqs)
    expect(effective.map(r => r.id).sort()).toEqual(['ck-school', 'fb-school'])   // both authorities apply
  })
})

// Age is an ordinary requirement on a VIRTUAL field computed from dob — there is
// no persons.age column, and no band/derivation step to test.
describe('age as an ordinary requirement', () => {
  const at = new Date('2026-07-17T00:00:00Z')
  const aged = (years: number) => ({ dob: `${at.getFullYear() - years}-01-01`, custom_fields: {} })
  const ageReq = (op: any, value: any) => req({ field_key: AGE_FIELD_KEY, field_source: 'core', operator: op, value })

  it('computes age from dob rather than reading a stored column', () => {
    expect(personValueFor(aged(12), { field_key: 'age', field_source: 'core' }, at)).toBe(12)
    expect(personValueFor({ dob: null }, { field_key: 'age', field_source: 'core' }, at)).toBeNull()
  })

  it('"a junior is anyone under 16" is Age Is At Most 15', () => {
    const r = ageReq('Is At Most', 15)
    expect(testRequirement(aged(15), r, CATALOGUE, at)).toBe(true)
    expect(testRequirement(aged(16), r, CATALOGUE, at)).toBe(false)
  })

  it('Is At Least and Is Between are inclusive at both ends', () => {
    expect(testRequirement(aged(16), ageReq('Is At Least', 16), CATALOGUE, at)).toBe(true)
    expect(testRequirement(aged(15), ageReq('Is At Least', 16), CATALOGUE, at)).toBe(false)
    const band = ageReq('Is Between', [5, 15])
    expect(testRequirement(aged(5), band, CATALOGUE, at)).toBe(true)
    expect(testRequirement(aged(15), band, CATALOGUE, at)).toBe(true)
    expect(testRequirement(aged(16), band, CATALOGUE, at)).toBe(false)
    expect(testRequirement(aged(4), band, CATALOGUE, at)).toBe(false)
  })

  it('an open-ended Is Between only bounds the end that is set', () => {
    expect(testRequirement(aged(40), ageReq('Is Between', [null, 15]), CATALOGUE, at)).toBe(false)
    expect(testRequirement(aged(40), ageReq('Is Between', [16, null]), CATALOGUE, at)).toBe(true)
  })

  // Without a dob we cannot PROVE someone is out of band. Saying "false" would
  // accuse them on data we don't have; saying "true" would hide a real gap.
  it('no dob is UNTESTABLE, not a failure', () => {
    expect(testRequirement({ dob: null }, ageReq('Is At Most', 15), CATALOGUE, at)).toBeNull()
    const { effective } = effectiveRequirements('jr', TREE, [{ ...ageReq('Is At Most', 15), discipline_id: 'jr' }])
    const [u] = unmetFor({ dob: null }, effective, { catalogue: CATALOGUE, asOf: at })
    expect(u.reason).toBe('unknown')
    expect(u.message).toMatch(/Date of birth isn't recorded/)
  })

  it('an out-of-band person reads as a mismatch, with a message that says so', () => {
    const { effective } = effectiveRequirements('jr', TREE, [{ ...ageReq('Is At Most', 15), discipline_id: 'jr' }])
    const [u] = unmetFor(aged(17), effective, { catalogue: CATALOGUE, asOf: at })
    expect(u.reason).toBe('mismatch')
    expect(u.message).toBe('Age must be at most 15 for Junior Football')
  })

  it('inherits and overrides exactly like any other requirement', () => {
    const reqs = [
      { ...ageReq('Is At Least', 5), id: 'fb-age', discipline_id: 'fb' },
      { ...ageReq('Is At Most', 15), id: 'jr-age', discipline_id: 'jr' },
    ]
    const { effective, shadowed } = effectiveRequirements('jr', TREE, reqs)
    expect(effective.map(r => r.id)).toEqual(['jr-age'])     // no second inheritance rule to learn
    expect(shadowed.map(r => r.id)).toEqual(['fb-age'])
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
//
// A class links to the SPECIFIC discipline (Junior Football / Senior Football) —
// there is no derivation from the parent. "Under 16" is a requirement on the junior
// discipline, so a 17-year-old in a junior class is flagged rather than quietly
// re-sorted into seniors.
describe('the whole point', () => {
  const at = new Date('2026-07-17T00:00:00Z')
  const FULL: DisciplineRequirement[] = [
    ...REQS,
    req({ id: 'jr-age', discipline_id: 'jr', field_key: AGE_FIELD_KEY, field_source: 'core', operator: 'Is At Most', value: 15 }),
    req({ id: 'sr-age', discipline_id: 'sr', field_key: AGE_FIELD_KEY, field_source: 'core', operator: 'Is At Least', value: 16 }),
  ]
  const footballer = (age: number, fields: Record<string, any> = {}) => ({
    person_types: ['member'], dob: `${at.getFullYear() - age}-01-01`, custom_fields: fields,
  })
  // `linked` is the discipline the CLASS is connected to.
  const flags = (person: any, linked: string) =>
    unmetFor(person, effectiveRequirementsForMany([linked], TREE, FULL, { personTypeKeys: ['member'] }).effective,
      { catalogue: CATALOGUE, asOf: at }).map(u => u.fieldLabel)

  it('a junior footballer needs their school, not their job', () => {
    expect(flags(footballer(12), 'jr')).toEqual(['School'])
    expect(flags(footballer(12, { [SCHOOL_ID]: 'Local Primary' }), 'jr')).toEqual([])
  })

  it('a senior player needs their job, not their school', () => {
    expect(flags(footballer(30), 'sr')).toEqual(['Job'])
    expect(flags(footballer(30, { [JOB_ID]: 'Builder' }), 'sr')).toEqual([])
  })

  it('16 is the line — a 17-year-old in a junior class is flagged for it', () => {
    expect(flags(footballer(15, { [SCHOOL_ID]: 'Local Primary' }), 'jr')).toEqual([])
    expect(flags(footballer(17, { [SCHOOL_ID]: 'Local Primary' }), 'jr')).toEqual(['Age'])
  })

  it('the junior exemption stops seniors-only rules reaching juniors', () => {
    // Job is required on Football (the parent) and exempt on Junior Football.
    expect(flags(footballer(12, { [SCHOOL_ID]: 'X' }), 'jr')).toEqual([])
    expect(flags(footballer(12, { [SCHOOL_ID]: 'X' }), 'fb')).toEqual(['Job'])
  })
})
