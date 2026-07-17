import { describe, it, expect } from 'vitest'
import {
  expandTypeKeys, linksForTypes, chainForPersonTypes,
  type PersonTypeLink,
} from '../../composables/useOrgFieldPolicy'

// The case this whole thing exists for, in one picture:
//
//   Harbourside Racquets calls them "Footballer" (key 'footballer').
//   Football NZ  calls them "Player"  and targets its fields at 'player'.
//   Tennis NZ    calls them "Athlete" and targets its fields at 'athlete'.
//
// Before migration 272 a field reached a club type ONLY by spelling its key the
// same, so renaming Player → Footballer silently detached every governing body —
// no error, an empty Fields tab identical to a working one. The link makes the
// club's LABEL free: resolution walks the linked bodies' keys instead.

const link = (o: Partial<PersonTypeLink> = {}): PersonTypeLink => ({
  id: 'l1', type_id: 't-player', source_type_id: 's-1',
  source_key: 'player', source_label: 'Player',
  source_org_id: 'o-football', source_org_name: 'Football NZ',
  ...o,
})

describe('expandTypeKeys', () => {
  // The walk starts from startTypeIds and only follows links out of types it has
  // reached — passing links without a start is how a body's fields would leak onto
  // a type that never answered to it.
  const FROM = ['t-player']

  it('keeps the club key and adds every linked body key', () => {
    const chain = expandTypeKeys(['footballer'], [
      link({ id: 'a', source_key: 'player', source_org_name: 'Football NZ' }),
      link({ id: 'b', source_key: 'athlete', source_org_name: 'Tennis NZ' }),
    ], FROM)
    expect(chain).toEqual(['footballer', 'player', 'athlete'])
  })

  it('is the no-op it must be when nothing is linked', () => {
    // The pre-272 world. Nothing regresses for an unaffiliated club.
    expect(expandTypeKeys(['member'], [], FROM)).toEqual(['member'])
  })

  it('contributes nothing without a starting type — links alone are not a chain', () => {
    // Guards the signature: a caller that forgets startTypeIds gets its own keys
    // back, never someone else's. (This is what caught PersonFormBuilder when the
    // walk went transitive.)
    expect(expandTypeKeys(['member'], [link({ source_key: 'player' })])).toEqual(['member'])
  })

  it('dedupes case-insensitively — the club and the body may agree on the word', () => {
    // The common case: both say "Player". One key out, not two, or every consumer
    // that counts keys would double-count.
    expect(expandTypeKeys(['Player'], [link({ source_key: 'player' })], FROM)).toEqual(['Player'])
  })

  it('survives empty/undefined input rather than throwing', () => {
    expect(expandTypeKeys([], [])).toEqual([])
    expect(expandTypeKeys(undefined as any, undefined as any)).toEqual([])
  })

  it('drops a link with no source key instead of adding an empty string', () => {
    // An empty key would match a field whose targets[] contains '' — silently
    // widening the chain to junk.
    expect(expandTypeKeys(['player'], [link({ source_key: '' })], FROM)).toEqual(['player'])
  })

  it('four bodies, ONE club type — the case that motivated the design', () => {
    const chain = expandTypeKeys(['player'], [
      link({ id: '1', source_type_id: 's1', source_key: 'player',  source_org_name: 'Tennis NZ' }),
      link({ id: '2', source_type_id: 's2', source_key: 'member',  source_org_name: 'Badminton NZ' }),
      link({ id: '3', source_type_id: 's3', source_key: 'athlete', source_org_name: 'Squash NZ' }),
      link({ id: '4', source_type_id: 's4', source_key: 'competitor', source_org_name: 'Pickleball NZ' }),
    ], FROM)
    // One person, one type, four bodies' vocabularies answered at once.
    expect(chain).toEqual(['player', 'member', 'athlete', 'competitor'])
  })
})

describe('transitive resolution — the three-level hierarchy', () => {
  // The normal shape of the real world, and the one that broke a one-hop walk:
  //
  //   Mount Sports "Member"  →  Auckland Football "Player"  →  Football NZ "Athlete"
  //
  // A Regional has its OWN people, PUBLISHES standards to its clubs, AND is itself
  // under a National. Stopping at one hop meant Football NZ's fields reached the
  // club only by COINCIDENCE — if Auckland and Football NZ happened to spell the
  // key the same. Different words, and they vanish silently.
  const clubTypes = [{ id: 't-club', key: 'member' }]
  const links = [
    link({ id: 'c', type_id: 't-club', source_type_id: 't-akl', source_key: 'player', source_org_name: 'Auckland Football' }),
    link({ id: 'a', type_id: 't-akl', source_type_id: 't-nat', source_key: 'athlete', source_org_name: 'Football NZ' }),
  ]

  it('follows the chain all the way to the National', () => {
    expect(chainForPersonTypes(['member'], clubTypes, links)).toEqual(['member', 'player', 'athlete'])
  })

  it('does not require the bodies to agree on a word', () => {
    // Auckland says Player, Football NZ says Athlete. A one-hop walk gave
    // ['member','player'] and the National's fields were silently lost.
    const chain = chainForPersonTypes(['member'], clubTypes, links)
    expect(chain).toContain('athlete')
  })

  it('only walks from the types you start at — a sibling club type leaks nothing', () => {
    const withSibling = [...links, link({ id: 'x', type_id: 't-other', source_key: 'referee' })]
    expect(chainForPersonTypes(['member'], clubTypes, withSibling)).not.toContain('referee')
  })

  it('survives a cycle instead of hanging — nothing in the schema forbids A→B→A', () => {
    const cyclic = [
      link({ id: '1', type_id: 't-a', source_type_id: 't-b', source_key: 'b' }),
      link({ id: '2', type_id: 't-b', source_type_id: 't-a', source_key: 'a' }),
    ]
    expect(expandTypeKeys(['a'], cyclic, ['t-a']).sort()).toEqual(['a', 'b'])
  })

  it('a diamond yields each key once', () => {
    // Club → two bodies that both answer to the same National.
    const diamond = [
      link({ id: '1', type_id: 't-club', source_type_id: 't-x', source_key: 'px' }),
      link({ id: '2', type_id: 't-club', source_type_id: 't-y', source_key: 'py' }),
      link({ id: '3', type_id: 't-x', source_type_id: 't-nat', source_key: 'nat' }),
      link({ id: '4', type_id: 't-y', source_type_id: 't-nat', source_key: 'nat' }),
    ]
    expect(expandTypeKeys(['member'], diamond, ['t-club'])).toEqual(['member', 'px', 'py', 'nat'])
  })
})

describe('linksForTypes', () => {
  it('narrows to the given types — a body must not leak onto a type that never answered to it', () => {
    const links = [
      link({ id: 'a', type_id: 't-player', source_key: 'player' }),
      link({ id: 'b', type_id: 't-coach',  source_key: 'coach' }),
    ]
    expect(linksForTypes(links, ['t-player']).map(l => l.id)).toEqual(['a'])
  })

  it('returns nothing for a type with no links', () => {
    expect(linksForTypes([link()], ['t-nobody'])).toEqual([])
  })
})

describe('the case Karl described: juniors\' players and juniors\' coaches', () => {
  // "Somehow we need to be able to set junior players have these fields but the
  // junior coaches have these fields."
  //
  // ONE discipline (Juniors), TWO rules, each scoped to one of the BODY's person
  // types. The club calls its people something else entirely — so the scoping only
  // resolves through the links. Before them, a rule saying 'player' matched a
  // person typed 'member' never, and the whole feature was inert.
  const clubTypes = [
    { id: 't-mem', key: 'member' },   // the club's word for a player
    { id: 't-cch', key: 'coach' },
  ]
  const links = [
    link({ id: 'a', type_id: 't-mem', source_key: 'player', source_org_name: 'Football NZ' }),
    link({ id: 'b', type_id: 't-cch', source_key: 'coach', source_org_name: 'Football NZ' }),
  ]
  // What the body authored on the Juniors discipline.
  const playerRule = { applies_to: ['player'] }   // Football NZ ID
  const coachRule = { applies_to: ['coach'] }     // Coaching certificate
  const everyoneRule = { applies_to: [] as string[] }  // e.g. Date of birth

  // Mirrors requirementApplies' comparison without importing the whole composable.
  const applies = (req: { applies_to: string[] }, chain: string[]) =>
    !req.applies_to.length || req.applies_to.some(t => chain.map(k => k.toLowerCase()).includes(t.toLowerCase()))

  it('the players-only rule reaches a club "Member" — via the link, not the word', () => {
    const chain = chainForPersonTypes(['member'], clubTypes, links)
    expect(applies(playerRule, chain)).toBe(true)
  })

  it('and leaves the coach alone — which is the entire point of scoping', () => {
    const chain = chainForPersonTypes(['coach'], clubTypes, links)
    expect(applies(playerRule, chain)).toBe(false)
    expect(applies(coachRule, chain)).toBe(true)
  })

  it('an unscoped rule still hits everyone — the pre-existing behaviour survives', () => {
    expect(applies(everyoneRule, chainForPersonTypes(['member'], clubTypes, links))).toBe(true)
    expect(applies(everyoneRule, chainForPersonTypes(['coach'], clubTypes, links))).toBe(true)
  })

  it('a playing coach is subject to BOTH rules', () => {
    const chain = chainForPersonTypes(['member', 'coach'], clubTypes, links)
    expect(applies(playerRule, chain)).toBe(true)
    expect(applies(coachRule, chain)).toBe(true)
  })

  it('without the link, the players-only rule finds NOBODY — the bug this fixes', () => {
    const chain = chainForPersonTypes(['member'], clubTypes, [])
    expect(chain).toEqual(['member'])
    expect(applies(playerRule, chain)).toBe(false)   // silently, with no error
  })
})

describe('chainForPersonTypes', () => {
  const clubTypes = [
    { id: 't-player', key: 'footballer' },
    { id: 't-coach', key: 'coach' },
  ]
  const links = [
    link({ id: 'a', type_id: 't-player', source_key: 'player', source_org_name: 'Football NZ' }),
    link({ id: 'b', type_id: 't-coach', source_key: 'official', source_org_name: 'Football NZ' }),
  ]

  it('expands only the types the person actually holds', () => {
    // A footballer must NOT pick up the fields Football targets at its officials.
    expect(chainForPersonTypes(['footballer'], clubTypes, links)).toEqual(['footballer', 'player'])
  })

  it('unions across every type a person holds — a playing coach gets both', () => {
    const chain = chainForPersonTypes(['footballer', 'coach'], clubTypes, links)
    expect(chain).toEqual(['footballer', 'coach', 'player', 'official'])
  })

  it('matches the person type key case-insensitively', () => {
    // persons.person_types[] is free text; the club type's key is slugified. They
    // will disagree on case eventually.
    expect(chainForPersonTypes(['Footballer'], clubTypes, links)).toEqual(['Footballer', 'player'])
  })

  it('ignores a person type the club no longer has', () => {
    // A deleted type leaves the key on the person row. It contributes itself and
    // nothing more — never someone else's links.
    expect(chainForPersonTypes(['ghost'], clubTypes, links)).toEqual(['ghost'])
  })

  it('is the identity when the club has no links at all', () => {
    expect(chainForPersonTypes(['footballer'], clubTypes, [])).toEqual(['footballer'])
  })
})
