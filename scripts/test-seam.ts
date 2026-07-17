// Full seam test suite. Seeds a National → Regional → 2 Clubs hierarchy, then
// exercises every repository function across all domains and records pass/fail.
// Writes a machine-readable result to _test/seam-results.json (consumed by the
// report generator) and prints a matrix.
//
// A test PASSES if its call completes without throwing and returns the expected
// kind (array / object / null). Empty results are fine — most tables are sparse
// for a fresh hierarchy; the point is that the whole path (Drizzle → MySQL →
// domain mapping → contract shape) executes cleanly.
//
// Run: `npx tsx scripts/test-seam.ts`.
import { mkdirSync, writeFileSync } from 'node:fs'
import * as org from '../server/db/repositories/organisations'
import * as people from '../server/db/repositories/people'
import * as types from '../server/db/repositories/personTypes'
import * as disc from '../server/db/repositories/disciplines'
import * as groups from '../server/db/repositories/groups'
import * as events from '../server/db/repositories/events'
import * as bookings from '../server/db/repositories/bookings'
import * as memberships from '../server/db/repositories/memberships'
import * as affiliations from '../server/db/repositories/affiliations'
import * as forms from '../server/db/repositories/forms'
import * as circles from '../server/db/repositories/circles'
import * as resources from '../server/db/repositories/resources'
import * as roles from '../server/db/repositories/roles'
import * as finances from '../server/db/repositories/finances'
import * as admin from '../server/db/repositories/admin'
import * as waitlists from '../server/db/repositories/waitlists'

type Result = { group: string; name: string; pass: boolean; note: string }
const results: Result[] = []

async function test(group: string, name: string, fn: () => Promise<any>, expect: 'array' | 'object' | 'nullable' | 'any' = 'array') {
  try {
    const r = await fn()
    let ok = true, note = ''
    if (expect === 'array') { ok = Array.isArray(r); note = ok ? `${r.length} rows` : `expected array, got ${typeof r}` }
    else if (expect === 'object') { ok = r !== null && typeof r === 'object'; note = ok ? 'object' : 'expected object' }
    else if (expect === 'nullable') { ok = r === null || typeof r === 'object'; note = r === null ? 'null (ok)' : 'object' }
    else note = 'ran'
    results.push({ group, name, pass: ok, note })
  } catch (e: any) {
    results.push({ group, name, pass: false, note: e.message?.slice(0, 120) ?? 'error' })
  }
}

async function main() {
  console.log('Seeding National → Regional → 2 Clubs …')
  const nat = await org.createOrganisation({ name: 'Test Football NZ', orgLevel: 'NATIONAL', slug: 'test-fnz' })
  const region = await org.createOrganisation({ name: 'Test Auckland Football', orgLevel: 'REGIONAL', parentId: nat.id, slug: 'test-akl' })
  const club1 = await org.createOrganisation({ name: 'Test Club One', orgLevel: 'CLUB', parentId: region.id, slug: 'test-c1' })
  const club2 = await org.createOrganisation({ name: 'Test Club Two', orgLevel: 'CLUB', parentId: region.id, slug: 'test-c2' })
  const O = club1.id
  const DUMMY = '00000000-0000-0000-0000-000000000000'

  // Organisations (incl. write CRUD + tree)
  await test('Organisations', 'listOrganisations', () => org.listOrganisations())
  await test('Organisations', 'getOrganisation', () => org.getOrganisation(nat.id), 'object')
  await test('Organisations', 'getAncestors(club→national)', async () => {
    const a = await org.getAncestors(club1.id)
    if (!a.some((x: any) => x.id === nat.id)) throw new Error('national not in ancestors')
    return a
  })
  await test('Organisations', 'getDescendants(national→clubs)', async () => {
    const d = await org.getDescendants(nat.id)
    if (!d.some((x: any) => x.id === club1.id)) throw new Error('club not in descendants')
    return d
  })
  await test('Organisations', 'create+update+delete', async () => {
    const t = await org.createOrganisation({ name: 'Ephemeral', orgLevel: 'CLUB' })
    const u = await org.updateOrganisation(t.id, { name: 'Ephemeral2' })
    if (u?.name !== 'Ephemeral2') throw new Error('update failed')
    await org.deleteOrganisation(t.id)
    if (await org.getOrganisation(t.id)) throw new Error('delete failed')
    return [t]
  })

  // People
  await test('People', 'listPeople', () => people.listPeople(O))
  await test('People', 'getPerson(dummy)', () => people.getPerson(DUMMY), 'nullable')

  // Types & Fields
  await test('Types & Fields', 'listPersonTypes', () => types.listPersonTypes(O))
  await test('Types & Fields', 'listFieldDefinitions', () => types.listFieldDefinitions(O))
  await test('Types & Fields', 'listPersonTypeLinks', () => types.listPersonTypeLinks(O))

  // Disciplines
  await test('Disciplines', 'listDisciplines', () => disc.listDisciplines(O))
  await test('Disciplines', 'listRequirements([])', () => disc.listRequirements([]))
  await test('Disciplines', 'listGroupDisciplines', () => disc.listGroupDisciplines(DUMMY))
  await test('Disciplines', 'listEventDisciplines', () => disc.listEventDisciplines(DUMMY))

  // Groups
  await test('Groups', 'listGroups', () => groups.listGroups(O))
  await test('Groups', 'getGroup(dummy)', () => groups.getGroup(DUMMY), 'nullable')
  await test('Groups', 'listCodes', () => groups.listCodes(O))
  await test('Groups', 'listMemberships', () => groups.listMemberships(DUMMY))
  await test('Groups', 'listSchedules', () => groups.listSchedules(DUMMY))
  await test('Groups', 'listFeeOptions', () => groups.listFeeOptions(DUMMY))

  // Events
  await test('Events', 'listEvents', () => events.listEvents(O))
  await test('Events', 'getEvent(dummy)', () => events.getEvent(DUMMY), 'nullable')
  await test('Events', 'listSessions', () => events.listSessions(DUMMY))
  await test('Events', 'listInvitees', () => events.listInvitees(DUMMY))
  await test('Events', 'listRegistrations', () => events.listRegistrations(DUMMY))

  // Bookings
  await test('Bookings', 'listBookables', () => bookings.listBookables(O))
  await test('Bookings', 'getBookable(dummy)', () => bookings.getBookable(DUMMY), 'nullable')
  await test('Bookings', 'listActivities', () => bookings.listActivities(O))
  await test('Bookings', 'getActivity(dummy)', () => bookings.getActivity(DUMMY), 'nullable')
  await test('Bookings', 'listActivityModes', () => bookings.listActivityModes(DUMMY))
  await test('Bookings', 'listBookings', () => bookings.listBookings(O))

  // Memberships
  await test('Memberships', 'listPlans', () => memberships.listPlans(O))
  await test('Memberships', 'listEntitlements', () => memberships.listEntitlements(DUMMY))
  await test('Memberships', 'listTerms', () => memberships.listTerms(O))
  await test('Memberships', 'listTermSets', () => memberships.listTermSets(O))

  // Affiliations
  await test('Affiliations', 'listOrgSports', () => affiliations.listOrgSports(O))
  await test('Affiliations', 'listManagerGrants', () => affiliations.listManagerGrants(O))
  await test('Affiliations', 'listLocations', () => affiliations.listLocations(O))
  await test('Affiliations', 'listLocationStaff', () => affiliations.listLocationStaff(O))

  // Forms
  await test('Forms', 'listForms', () => forms.listForms(O))
  await test('Forms', 'getForm(dummy)', () => forms.getForm(DUMMY), 'nullable')
  await test('Forms', 'listTargets', () => forms.listTargets(DUMMY))
  await test('Forms', 'listSubmissions', () => forms.listSubmissions(O))

  // Circles / Entities
  await test('Circles/Entities', 'listCirclesForPerson', () => circles.listCirclesForPerson(DUMMY))
  await test('Circles/Entities', 'listCircleMembers', () => circles.listCircleMembers(DUMMY))
  await test('Circles/Entities', 'listNotes', () => circles.listNotes(DUMMY))
  await test('Circles/Entities', 'listEntities', () => circles.listEntities(O))
  await test('Circles/Entities', 'listEntityMembers', () => circles.listEntityMembers(DUMMY))

  // Resources
  await test('Resources', 'listFolders', () => resources.listFolders(O))
  await test('Resources', 'listResources', () => resources.listResources(O))
  await test('Resources', 'listTargets', () => resources.listTargets('folder', DUMMY))
  await test('Resources', 'listViews', () => resources.listViews(DUMMY))

  // Roles / Permissions
  await test('Roles/Permissions', 'listScopedRoleDefs', () => roles.listScopedRoleDefs(O))
  await test('Roles/Permissions', 'listPermissionGroups (+core)', async () => {
    const pg = await roles.listPermissionGroups(O)
    return pg
  })
  await test('Roles/Permissions', 'listCodeStaff', () => roles.listCodeStaff(O))

  // Finances
  await test('Finances', 'listDiscounts', () => finances.listDiscounts(O))
  await test('Finances', 'listBookingDiscounts', () => finances.listBookingDiscounts(O))
  await test('Finances', 'getXeroConnection', () => finances.getXeroConnection(O), 'nullable')

  // Admin / Master (global)
  await test('Admin/Master', 'listBrands', () => admin.listBrands())
  await test('Admin/Master', 'listClubTypes', () => admin.listClubTypes())
  await test('Admin/Master', 'listSportCategories', () => admin.listSportCategories())
  await test('Admin/Master', 'listHelpArticles', () => admin.listHelpArticles())
  await test('Admin/Master', 'listPageReviewers', () => admin.listPageReviewers(O))

  // Waitlists / Communications
  await test('Waitlists/Comms', 'listWaitlists', () => waitlists.listWaitlists(O))
  await test('Waitlists/Comms', 'listCommunications', () => waitlists.listCommunications(O))
  await test('Waitlists/Comms', 'listCommunicationTopics', () => waitlists.listCommunicationTopics(O))
  await test('Waitlists/Comms', 'listEmailTemplates', () => waitlists.listEmailTemplates(O))
  await test('Waitlists/Comms', 'listCalendars', () => waitlists.listCalendars(O))

  // ── WRITE CRUD (create → update → delete → confirm gone) ──
  async function crud(group: string, name: string, create: () => Promise<any>, update: (id: string) => Promise<any>, del: (id: string) => Promise<void>, get: (id: string) => Promise<any>) {
    try {
      const c = await create()
      if (!c?.id) throw new Error('create returned no id')
      await update(c.id)
      await del(c.id)
      if (await get(c.id)) throw new Error('row not deleted')
      results.push({ group, name, pass: true, note: 'create→update→delete OK' })
    } catch (e: any) { results.push({ group, name, pass: false, note: e.message?.slice(0, 120) ?? 'error' }) }
  }
  await crud('People', 'person write CRUD', () => people.createPerson({ orgId: O, firstName: 'T', lastName: 'X' } as any), id => people.updatePerson(id, { lastName: 'Y' } as any), id => people.deletePerson(id), id => people.getPerson(id))
  await crud('Groups', 'group write CRUD', () => groups.createGroup({ orgId: O, name: 'T' } as any), id => groups.updateGroup(id, { name: 'Y' } as any), id => groups.deleteGroup(id), id => groups.getGroup(id))
  await crud('Events', 'event write CRUD', () => events.createEvent({ orgId: O, title: 'T' } as any), id => events.updateEvent(id, { title: 'Y' } as any), id => events.deleteEvent(id), id => events.getEvent(id))
  await crud('Bookings', 'bookable write CRUD', () => bookings.createBookable({ orgId: O, name: 'T' } as any), id => bookings.updateBookable(id, { name: 'Y' } as any), id => bookings.deleteBookable(id), id => bookings.getBookable(id))
  await crud('Bookings', 'activity write CRUD', () => bookings.createActivity({ orgId: O, name: 'T' } as any), id => bookings.updateActivity(id, { name: 'Y' } as any), id => bookings.deleteActivity(id), id => bookings.getActivity(id))
  await crud('Forms', 'form write CRUD', () => forms.createForm({ orgId: O, name: 'T' } as any), id => forms.updateForm(id, { name: 'Y' } as any), id => forms.deleteForm(id), id => forms.getForm(id))

  // ── MULTI-SPORT CLUB (the case that drove this work) ──
  // One club, four sports, four separate national bodies — the exact shape a
  // multi-sport club takes. Verifies the seam handles many affiliations on one org
  // and that the hierarchy walks resolve each body.
  const msBodies: any[] = []
  const msClubId = club1.id
  try {
    for (const s of ['Tennis', 'Badminton', 'Squash', 'Pickleball']) {
      const body = await org.createOrganisation({ name: `Test ${s} NZ`, orgLevel: 'NATIONAL', slug: `test-${s.toLowerCase()}-nz` })
      msBodies.push(body)
      await affiliations.createOrgSport({ orgId: msClubId, sport: s, nsoOrgId: body.id, isPrimary: s === 'Tennis' } as any)
    }
    const sports = await affiliations.listOrgSports(msClubId)
    if (sports.length < 4) throw new Error(`expected ≥4 org_sports, got ${sports.length}`)
    results.push({ group: 'Multi-sport', name: 'club affiliates 4 sports to 4 bodies', pass: true, note: `${sports.length} org_sports on one club` })

    // Each body must see the club as one of its affiliates.
    let seen = 0
    for (const b of msBodies) { if ((await affiliations.listAffiliationsForBody(b.id)).some(a => a.orgId === msClubId)) seen++ }
    results.push({ group: 'Multi-sport', name: 'each body lists the club as an affiliate', pass: seen === 4, note: `${seen}/4 bodies see the club` })

    // The club's ancestor walk resolves its regional + national parents (the
    // primary-sport chain via parent_id).
    const anc = await org.getAncestors(msClubId)
    const okAnc = anc.some(a => a.id === region.id) && anc.some(a => a.id === nat.id)
    results.push({ group: 'Multi-sport', name: 'ancestor walk resolves region + national', pass: okAnc, note: `${anc.length} ancestors` })
  } catch (e: any) {
    results.push({ group: 'Multi-sport', name: 'multi-sport scenario', pass: false, note: e.message?.slice(0, 120) ?? 'error' })
  } finally {
    // Detach the org_sports (FK to the club) then remove the four extra bodies.
    for (const s of await affiliations.listOrgSports(msClubId)) { try { await affiliations.deleteOrgSport(s.id) } catch {} }
    for (const b of msBodies) { try { await org.deleteOrganisation(b.id) } catch {} }
  }

  // Clean up the seeded hierarchy so re-runs stay idempotent.
  for (const id of [club1.id, club2.id, region.id, nat.id]) await org.deleteOrganisation(id)

  // ── Report ──
  const groupsMap = new Map<string, Result[]>()
  for (const r of results) (groupsMap.get(r.group) ?? groupsMap.set(r.group, []).get(r.group)!).push(r)
  const passed = results.filter(r => r.pass).length
  console.log(`\n${'='.repeat(60)}\nSEAM TEST RESULTS — ${passed}/${results.length} passed\n${'='.repeat(60)}`)
  for (const [g, rs] of groupsMap) {
    const gp = rs.filter(r => r.pass).length
    console.log(`\n${g}  (${gp}/${rs.length})`)
    for (const r of rs) console.log(`  ${r.pass ? '✅' : '❌'} ${r.name.padEnd(34)} ${r.note}`)
  }
  mkdirSync('_test', { recursive: true })
  writeFileSync('_test/seam-results.json', JSON.stringify({ passed, total: results.length, results }, null, 2))
  console.log(`\nwrote _test/seam-results.json`)
  process.exit(results.every(r => r.pass) ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
