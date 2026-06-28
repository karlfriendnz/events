import { describe, it, expect } from 'vitest'
import { PROFILE_PRESETS, resolvePreset, type SubjectType } from '../../composables/useFormProfilePresets'

// Mirrors the seeded NZC subject types (7 person + 3 entity) that flow down to
// every club via inheritance. Tests resolve presets against this fixture.
const NZC_TYPES: SubjectType[] = [
  { key: 'member', label: 'Member / Player', kind: 'person', min_count: 1, max_count: 1 },
  { key: 'guardian', label: 'Parent / Guardian', kind: 'person', min_count: 1, max_count: 2 },
  { key: 'contact', label: 'Emergency Contact', kind: 'person', min_count: 1, max_count: 3 },
  { key: 'coach', label: 'Coach', kind: 'person', min_count: 0, max_count: null },
  { key: 'manager', label: 'Team Manager', kind: 'person', min_count: 0, max_count: 2 },
  { key: 'volunteer', label: 'Volunteer', kind: 'person', min_count: 0, max_count: null },
  { key: 'medical', label: 'Medical / Physio', kind: 'person', min_count: 0, max_count: 1 },
  { key: 'team', label: 'Team', kind: 'entity', min_count: 1, max_count: 1 },
  { key: 'company', label: 'Company', kind: 'entity', min_count: 1, max_count: 1 },
  { key: 'school', label: 'School', kind: 'entity', min_count: 1, max_count: 1 },
]
// Only person types — used to prove entity roles fall back to a synthetic key.
const PEOPLE_ONLY = NZC_TYPES.filter(t => t.kind === 'person')

const preset = (id: string) => PROFILE_PRESETS.find(p => p.id === id)!
const simplify = (profiles: any[]) => profiles.map(p => ({ key: p.key, label: p.label, min: p.min, max: p.max, kind: p.kind }))

describe('PROFILE_PRESETS catalogue', () => {
  it('exposes the seven documented presets in order', () => {
    expect(PROFILE_PRESETS.map(p => p.id)).toEqual([
      'individual', 'couple', 'parent_child', 'family', 'team', 'company', 'school',
    ])
  })
  it('every preset has an icon and at least one role', () => {
    for (const p of PROFILE_PRESETS) {
      expect(p.icon).toBeTruthy()
      expect(p.roles.length).toBeGreaterThan(0)
    }
  })
})

describe('resolvePreset against full NZC subject types', () => {
  it('Individual → member + emergency contact', () => {
    expect(simplify(resolvePreset(NZC_TYPES, preset('individual')))).toEqual([
      { key: 'member', label: 'Individual', min: 1, max: 1, kind: 'person' },
      { key: 'contact', label: 'Emergency Contact', min: 1, max: 2, kind: 'person' },
    ])
  })

  it('Couple → 2 members + emergency contact', () => {
    expect(simplify(resolvePreset(NZC_TYPES, preset('couple')))).toEqual([
      { key: 'member', label: 'Member', min: 2, max: 2, kind: 'person' },
      { key: 'contact', label: 'Emergency Contact', min: 1, max: 2, kind: 'person' },
    ])
  })

  it('Parent / child → child first + guardian + emergency contact', () => {
    expect(simplify(resolvePreset(NZC_TYPES, preset('parent_child')))).toEqual([
      { key: 'member', label: 'Child', min: 1, max: 1, kind: 'person' },
      { key: 'guardian', label: 'Parent / Guardian', min: 1, max: 1, kind: 'person' },
      { key: 'contact', label: 'Emergency Contact', min: 1, max: 2, kind: 'person' },
    ])
  })

  it('Family → 1-2 guardians + 1-4 children + emergency contact', () => {
    expect(simplify(resolvePreset(NZC_TYPES, preset('family')))).toEqual([
      { key: 'guardian', label: 'Parent / Guardian', min: 1, max: 2, kind: 'person' },
      { key: 'member', label: 'Child', min: 1, max: 4, kind: 'person' },
      { key: 'contact', label: 'Emergency Contact', min: 1, max: 2, kind: 'person' },
    ])
  })

  it('Team → team entity + 12 players + 2 coaches + 2 managers + physio + emergency contact', () => {
    expect(simplify(resolvePreset(NZC_TYPES, preset('team')))).toEqual([
      { key: 'team', label: 'Team', min: 1, max: 1, kind: 'entity' },
      { key: 'member', label: 'Player', min: 12, max: null, kind: 'person' },
      { key: 'coach', label: 'Coach', min: 2, max: null, kind: 'person' },
      { key: 'manager', label: 'Team Manager', min: 2, max: null, kind: 'person' },
      { key: 'medical', label: 'Physio', min: 1, max: 1, kind: 'person' },
      { key: 'contact', label: 'Emergency Contact', min: 1, max: null, kind: 'person' },
    ])
  })

  it('Company → company entity + attendees', () => {
    expect(simplify(resolvePreset(NZC_TYPES, preset('company')))).toEqual([
      { key: 'company', label: 'Company', min: 1, max: 1, kind: 'entity' },
      { key: 'member', label: 'Attendee', min: 1, max: null, kind: 'person' },
    ])
  })

  it('School → school entity + students + supervising teacher', () => {
    expect(simplify(resolvePreset(NZC_TYPES, preset('school')))).toEqual([
      { key: 'school', label: 'School', min: 1, max: 1, kind: 'entity' },
      { key: 'member', label: 'Student', min: 1, max: null, kind: 'person' },
      { key: 'manager', label: 'Supervising Teacher', min: 1, max: null, kind: 'person' },
    ])
  })
})

describe('resolvePreset resilience', () => {
  it('every preset resolves to ≥1 profile for the full type set', () => {
    for (const p of PROFILE_PRESETS) {
      expect(resolvePreset(NZC_TYPES, p).length).toBeGreaterThan(0)
    }
  })

  it('never emits duplicate subject keys', () => {
    for (const p of PROFILE_PRESETS) {
      const keys = resolvePreset(NZC_TYPES, p).map(x => x.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('entity roles fall back to a synthetic entity profile when no entity type exists', () => {
    // With only person types, Team/Company/School still produce their entity via synthKey.
    const team = resolvePreset(PEOPLE_ONLY, preset('team'))
    expect(team.find(p => p.key === 'team')).toMatchObject({ key: 'team', kind: 'entity' })
    const company = resolvePreset(PEOPLE_ONLY, preset('company'))
    expect(company.find(p => p.key === 'company')).toMatchObject({ key: 'company', kind: 'entity' })
    const school = resolvePreset(PEOPLE_ONLY, preset('school'))
    expect(school.find(p => p.key === 'school')).toMatchObject({ key: 'school', kind: 'entity' })
  })

  it('flags the right "chooser" subject per preset (who picks sessions/fees)', () => {
    const chooser = (id: string) => resolvePreset(NZC_TYPES, preset(id)).filter(p => p.selectsOptions).map(p => p.key)
    expect(chooser('individual')).toEqual(['member'])   // the individual
    expect(chooser('couple')).toEqual(['member'])        // both members (one subject, count 2)
    expect(chooser('parent_child')).toEqual(['member'])  // the child, not the parent
    expect(chooser('family')).toEqual(['member'])        // the children
    expect(chooser('team')).toEqual(['team'])            // the team entity registers
    expect(chooser('company')).toEqual(['company'])      // the company entity
    expect(chooser('school')).toEqual(['school'])        // the school entity
  })

  it('exactly one chooser per preset by default', () => {
    for (const p of PROFILE_PRESETS) {
      const choosers = resolvePreset(NZC_TYPES, p).filter(x => x.selectsOptions)
      expect(choosers.length).toBe(1)
    }
  })

  it('matches a person type by label keyword, not just key', () => {
    // "physio" appears only in the label "Medical / Physio" (key is "medical").
    const team = resolvePreset(NZC_TYPES, preset('team'))
    expect(team.find(p => p.label === 'Physio')?.key).toBe('medical')
  })

  it('merges two roles that resolve to the same subject key, keeping the chooser flag', () => {
    // Org with only a "member" person type: two roles collide on key 'member'.
    const types: SubjectType[] = [{ key: 'member', label: 'Member', kind: 'person' }]
    const preset = { roles: [
      { match: ['member'], label: 'Parent', min: 1, max: 1 },
      { match: ['member'], label: 'Child', min: 1, max: 1, selects: true },
    ] }
    const res = resolvePreset(types, preset)
    expect(res.length).toBe(1)                 // same key → merged, not duplicated
    expect(res[0].selectsOptions).toBe(true)   // the later role's chooser flag survives
  })

  it('keeps an entity role as kind=entity even if the matched type is stored as person', () => {
    const types: SubjectType[] = [{ key: 'team', label: 'Team', kind: 'person' }]
    const res = resolvePreset(types, preset('team'))
    expect(res.find(p => p.key === 'team')?.kind).toBe('entity')
  })

  it('does not mutate the input types or preset', () => {
    const typesSnap = JSON.stringify(NZC_TYPES)
    const presetSnap = JSON.stringify(PROFILE_PRESETS)
    resolvePreset(NZC_TYPES, preset('team'))
    expect(JSON.stringify(NZC_TYPES)).toBe(typesSnap)
    expect(JSON.stringify(PROFILE_PRESETS)).toBe(presetSnap)
  })

  it('produces nothing extra when given an empty type set (synthetic-only)', () => {
    const team = resolvePreset([], preset('team'))
    // Only roles with a synthKey survive (team + emergency contact).
    expect(team.map(p => p.key).sort()).toEqual(['contact', 'team'])
  })
})
