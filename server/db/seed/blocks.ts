// SEED BLOCKS — the modular alternative to whole-club recipes. A block is one
// small, self-contained unit of demo data ("people", "terms", "groups", "events",
// "venues", "forms", "disciplines"). The org-detail Seed tab shows the blocks that
// apply to THIS org's kind (club vs governing body) and runs the chosen ones, in a
// sensible order, into the org — so "just people + groups + terms" or "just events"
// is a tick-box, not a bespoke recipe.
//
// Blocks go through the repositories (the only DB-aware layer), like recipes, so they
// survive a backend swap. Names read like a real club — no "[Demo]" prefix (reset is
// org-scoped, not name-based, so nothing depends on a marker).
import type { SeedOption, SeedSummary } from '../../../shared/contracts/devSeed'
import type { SeedContext } from './context'

export type OrgKind = 'club' | 'governing'

export interface SeedBlock {
  key: string
  label: string
  description: string
  // Which org kinds this block makes sense for.
  orgKinds: OrgKind[]
  options?: SeedOption[]
  run(ctx: SeedContext, opts: Record<string, any>): Promise<void>
}

// ── name pools (make the data read like a real club) ─────────────
const FIRST_F = ['Olivia', 'Charlotte', 'Amelia', 'Isla', 'Mia', 'Ella', 'Sophie', 'Grace', 'Ruby', 'Zoe', 'Ava', 'Chloe', 'Lily', 'Emily', 'Ana', 'Mere', 'Aroha', 'Priya', 'Mei', 'Fatima']
const FIRST_M = ['Noah', 'Liam', 'William', 'Jack', 'James', 'Lucas', 'Leo', 'Oliver', 'Henry', 'Thomas', 'George', 'Harry', 'Max', 'Samuel', 'Wiremu', 'Tane', 'Rahul', 'Omar', 'Sione', 'Ravi']
const FIRST = [...FIRST_F, ...FIRST_M]
const LAST = ['Smith', 'Wilson', 'Taylor', 'Williams', 'Brown', 'Jones', 'Thompson', 'Anderson', 'Walker', 'Robinson', 'Ngata', 'Patel', 'Nguyen', 'Kaur', 'Singh', 'Chen', 'Wang', 'Kim', 'Ali', 'Hussain', 'Murphy', 'Kelly', 'Reid', 'Clarke', 'Wright', 'Harris', 'Martin', 'Cooper', 'Edwards', 'Morgan']
const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'icloud.com']
// Programmes / venue / event names are themed per club style — see ctx.flavour
// (server/db/seed/flavours.ts).

// ── helpers ──────────────────────────────────────────────────────
function personEmail(ctx: SeedContext, first: string, last: string): string {
  return `${first}.${last}${ctx.randInt(1, 899)}@${ctx.pick(EMAIL_DOMAINS)}`.toLowerCase()
}

// ── the blocks ───────────────────────────────────────────────────

const personTypesBlock: SeedBlock = {
  key: 'personTypes',
  label: 'People types',
  description: 'The person types this club uses (e.g. Gymnast, Parent, Coach, Judge, Admin), matched to the club style.',
  orgKinds: ['club', 'governing'],
  async run(ctx) {
    const { personTypes } = ctx.repos
    const existing = await personTypes.listPersonTypes(ctx.orgId).catch(() => [] as any[])
    const have = new Set((existing as any[]).map(t => t.key))
    let order = existing.length
    for (const pt of ctx.flavour.personTypes) {
      if (have.has(pt.key)) continue // never duplicate an existing type
      await personTypes.createPersonType({
        orgId: ctx.orgId, key: pt.key, label: pt.label, kind: 'person',
        isAccess: !!pt.isAccess, isPublished: true, sortOrder: order++,
      } as any)
      ctx.count('personTypes')
    }
  },
}

const YEAR = 365
const peopleBlock: SeedBlock = {
  key: 'people',
  label: 'People',
  description: 'A realistic mix — families (parents linked to their kids), senior members, coaches and admins — typed to match the club style.',
  orgKinds: ['club', 'governing'],
  options: [{ key: 'count', label: 'Roughly how many people', type: 'number', default: 40 }],
  async run(ctx, opts) {
    const n = Math.max(4, Math.min(400, Number(opts.count ?? 40)))
    const { people, circles } = ctx.repos
    const memberKey = ctx.flavour.memberType.key
    const coachKey = ctx.flavour.coachType.key
    const hasParent = ctx.flavour.personTypes.some(t => t.key === 'parent')
    const juniorKey = ctx.flavour.personTypes.find(t => /junior/i.test(t.key))?.key ?? memberKey
    const accessTypes = ctx.flavour.personTypes.filter(t => t.isAccess)

    // Create one person; age in YEARS → a dob, first name matched to gender.
    async function mk(last: string, typeKey: string, ageYears: number, gender?: string | null) {
      const g = gender ?? ctx.pick(['MALE', 'FEMALE', 'FEMALE', 'MALE'])
      const first = g === 'FEMALE' ? ctx.pick(FIRST_F) : ctx.pick(FIRST_M)
      const p = await people.createPerson({
        orgId: ctx.orgId, firstName: first, lastName: last, email: personEmail(ctx, first, last),
        phone: `02${ctx.randInt(10, 29)} ${ctx.randInt(100, 999)} ${ctx.randInt(1000, 9999)}`,
        personTypes: [typeKey], personType: typeKey,
        dob: ctx.dayDate(-(ageYears * YEAR + ctx.randInt(0, YEAR))),
        gender: g,
      } as any)
      ctx.count('people')
      return p
    }

    let budget = n
    // 1. Admins (one of each access type — e.g. a Committee member + an Administrator;
    //    if the club has only one access type, seed two of it) + coaches.
    const adminKeys = accessTypes.length >= 2 ? accessTypes.slice(0, 2).map(t => t.key) : accessTypes.length === 1 ? [accessTypes[0].key, accessTypes[0].key] : []
    for (const ak of adminKeys) { if (budget <= 0) break; await mk(ctx.pick(LAST), ak, ctx.randInt(28, 58)); budget-- }
    const nCoaches = Math.min(budget, Math.max(2, Math.round(n * 0.1)))
    for (let i = 0; i < nCoaches; i++) { await mk(ctx.pick(LAST), coachKey, ctx.randInt(22, 55)); budget-- }

    // 2. Families — ~60% of the remaining people. Each: 1–2 parents (guardians) linked
    //    to 1–3 kids (junior members) in a family circle. Same surname.
    let familyBudget = Math.round(budget * 0.6)
    const parentKey = hasParent ? 'parent' : memberKey
    while (familyBudget >= 3 && budget >= 3) {
      const last = ctx.pick(LAST)
      const nParents = ctx.pick([1, 2, 2])
      const nKids = ctx.pick([1, 1, 2, 2, 3])
      if (budget < nParents + nKids) break
      // Parents: first is Mum (female), second is Dad (male). Relationship is stored
      // on the family link, so the household reads "Mum / Dad / Son / Daughter".
      const parents: { id: string; rel: string }[] = []
      for (let i = 0; i < nParents; i++) {
        const gender = i === 0 ? 'FEMALE' : 'MALE'
        const p = await mk(last, parentKey, ctx.randInt(32, 49), gender)
        parents.push({ id: (p as any).id, rel: gender === 'FEMALE' ? 'Mum' : 'Dad' }); budget--
      }
      // Kids: Son (male) / Daughter (female).
      const kids: { id: string; rel: string }[] = []
      for (let i = 0; i < nKids; i++) {
        const gender = ctx.pick(['MALE', 'FEMALE'])
        const k = await mk(last, juniorKey, ctx.randInt(5, 15), gender)
        kids.push({ id: (k as any).id, rel: gender === 'MALE' ? 'Son' : 'Daughter' }); budget--
      }
      familyBudget -= nParents + nKids
      // The family circle links them (guardian → dependent = manage/book/register).
      const circle = await circles.createCircle({ orgId: ctx.orgId, name: `${last} Family`, kind: 'family', color: ctx.pick(['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B']) } as any)
      ctx.count('families')
      // Parent 1 is the primary contact; parent 2 (if any) is the emergency contact.
      for (let i = 0; i < parents.length; i++) {
        const primary = i === 0
        await circles.addCircleMember({ circleId: circle.id, personId: parents[i].id, role: 'guardian', relationship: parents[i].rel, contactType: primary ? 'primary' : 'emergency', isPrimary: primary, canBookFor: true, canRegister: true, canView: true, receivesComms: true } as any)
      }
      // A single-parent family still gets a nominated emergency contact — a grandparent.
      if (parents.length === 1 && budget > 0) {
        const gp = await mk(last, parentKey, ctx.randInt(58, 76)); budget--
        await circles.addCircleMember({ circleId: circle.id, personId: (gp as any).id, role: 'guardian', relationship: 'Grandparent', contactType: 'emergency', canView: true, receivesComms: true } as any)
      }
      for (const k of kids) await circles.addCircleMember({ circleId: circle.id, personId: k.id, role: 'dependent', relationship: k.rel, canView: true } as any)
    }

    // 3. Senior / adult members — the rest.
    while (budget > 0) { await mk(ctx.pick(LAST), memberKey, ctx.randInt(18, 65)); budget-- }
  },
}

// Each term set is its OWN sequence. Every term belongs to a set (there is no
// "main"/null sequence) and carries a sign-up window (opens ~4 weeks before it
// starts, closes when it starts). Offsets are days from today, chosen so the states
// vary: some sets have a term that's running now, one whose sign-up is open now, and
// later terms whose sign-up hasn't opened yet.
const TERM_SET_TEMPLATES: { name: string; terms: (year: number) => { name: string; span: [number, number] }[] }[] = [
  {
    name: 'School Terms',
    terms: (y) => [
      { name: `Term 1 ${y}`, span: [-70, 0] },   // just ended → sign-up closed
      { name: `Term 2 ${y}`, span: [10, 80] },   // starts soon → sign-up OPEN now
      { name: `Term 3 ${y}`, span: [90, 160] },  // future → sign-up not open yet
      { name: `Term 4 ${y}`, span: [170, 240] },
    ],
  },
  {
    name: 'Holiday Programmes',
    terms: (y) => [
      { name: `Autumn Holidays ${y}`, span: [3, 13] },   // starts in days → sign-up OPEN now
      { name: `Winter Holidays ${y}`, span: [95, 105] },
      { name: `Spring Holidays ${y}`, span: [180, 190] },
    ],
  },
  {
    name: 'Competition Season',
    terms: (y) => [
      { name: `Winter Competition ${y}`, span: [10, 190] }, // long season, sign-up OPEN now
    ],
  },
]

const termsBlock: SeedBlock = {
  key: 'terms',
  label: 'Terms & sign-up periods',
  description: 'Multiple term sets (School Terms, Holiday Programmes, Competition Season), each a sequence of terms with sign-up windows. Every term belongs to a set.',
  orgKinds: ['club'],
  options: [{ key: 'sets', label: 'How many term sets', type: 'number', default: 2 }],
  async run(ctx, opts) {
    const { memberships, organisations } = ctx.repos
    const nSets = Math.max(1, Math.min(TERM_SET_TEMPLATES.length, Number(opts.sets ?? 2)))
    try { await organisations.updateProfile(ctx.orgId, { seasonStart: ctx.dayDate(-70), seasonEnd: ctx.dayDate(300) } as any) } catch { /* season is nice-to-have */ }
    const year = new Date().getFullYear()
    for (let si = 0; si < nSets; si++) {
      const tmpl = TERM_SET_TEMPLATES[si]
      const set = await memberships.createTermSet({ orgId: ctx.orgId, name: tmpl.name, sortOrder: si } as any)
      ctx.count('termSets')
      const defs = tmpl.terms(year)
      for (let t = 0; t < defs.length; t++) {
        const [startOff, endOff] = defs[t].span
        await memberships.createTerm({
          orgId: ctx.orgId, name: defs[t].name,
          startDate: ctx.dayDate(startOff), endDate: ctx.dayDate(endOff),
          signupOpen: ctx.dayDate(startOff - 28), signupClose: ctx.dayDate(startOff),
          status: 'active', setId: set.id, sortOrder: t,
        } as any)
        ctx.count('terms')
      }
    }
  },
}

const groupsBlock: SeedBlock = {
  key: 'groups',
  label: 'Classes & programmes',
  description: 'Real programmes (Junior Development, Youth Academy…) with named classes and members enrolled.',
  orgKinds: ['club'],
  options: [
    { key: 'count', label: 'How many classes', type: 'number', default: 8 },
    { key: 'acrossTerms', label: 'Spread across terms (for testing transfers/rollover)', type: 'boolean', default: true },
  ],
  async run(ctx, opts) {
    const n = Math.max(1, Math.min(40, Number(opts.count ?? 8)))
    const acrossTerms = opts.acrossTerms !== false
    const PROGRAMMES = ctx.flavour.programmes
    const coachKey = ctx.flavour.coachType.key
    // Members enrolled in classes = adult members AND junior members (kids), not
    // parents/coaches/admins.
    const memberKeys = new Set<string>([ctx.flavour.memberType.key, ...ctx.flavour.personTypes.filter(t => /junior/i.test(t.key)).map(t => t.key)])
    const { groups, memberships } = ctx.repos
    const allPeople = await ctx.repos.people.listPeople(ctx.orgId).catch(() => [] as any[])
    const typesOf = (p: any) => (p.personTypes ?? []) as string[]
    const members = (allPeople as any[]).filter(p => typesOf(p).some(k => memberKeys.has(k)))
    const coaches = (allPeople as any[]).filter(p => typesOf(p).includes(coachKey))

    // Terms this org runs in — a class instance belongs to one term, and the SAME
    // class (shared lineageId) can exist across consecutive terms so rollover/transfer
    // is testable. With several term SETS, base→roll must stay WITHIN one sequence, so
    // pick the set with the most terms (the main school-terms sequence) and use its
    // first two terms. If no terms exist yet, classes sit in the evergreen (null) term.
    const allTerms = await memberships.listTerms(ctx.orgId).catch(() => [] as any[])
    const bySet = new Map<string, any[]>()
    for (const t of allTerms as any[]) { const k = String(t.setId ?? ''); (bySet.get(k) ?? bySet.set(k, []).get(k)!).push(t) }
    const mainSeq = [...bySet.values()].sort((a, b) => b.length - a.length)[0] ?? []
    mainSeq.sort((a: any, b: any) => String(a.startDate).localeCompare(String(b.startDate)))
    const termForBase = mainSeq[0] ?? null       // current term
    const termForRoll = mainSeq[1] ?? null       // next term (rollover target)

    // Build the classes: walk the programmes in order, taking classes until we hit n.
    type Plan = { code: string; color: string; className: string }
    const plans: Plan[] = []
    let p = 0
    while (plans.length < n) {
      const prog = PROGRAMMES[p % PROGRAMMES.length]
      const idx = Math.floor(plans.length / PROGRAMMES.length)
      const className = prog.classes[idx % prog.classes.length] + (idx >= prog.classes.length ? ` ${idx + 1}` : '')
      plans.push({ code: prog.name, color: prog.color, className })
      p++
    }

    // Create the codes we actually referenced, once each.
    const codeIds: Record<string, string> = {}
    let order = 0
    for (const prog of PROGRAMMES) {
      if (!plans.some(pl => pl.code === prog.name)) continue
      const c = await groups.createCode({ orgId: ctx.orgId, name: prog.name, color: prog.color, sortOrder: order++ } as any)
      codeIds[prog.name] = c.id
      ctx.count('codes')
    }

    // Create one class instance in a given term, with a shared lineage across terms.
    async function makeClass(pl: Plan, term: any, lineageId: string, sortOrder: number, enrol: boolean, rolledFrom: string | null) {
      const head = coaches.length ? ctx.pick(coaches) : null
      const g = await groups.createGroup({
        orgId: ctx.orgId, name: pl.className, color: pl.color, codeId: codeIds[pl.code],
        capacity: ctx.pick([10, 12, 14, 16, 20]), termFee: ctx.pick([120, 140, 160, 180, 210]),
        headPersonId: head ? (head as any).id : null, sortOrder,
        termId: term ? term.id : null, lineageId, rolledFromGroupId: rolledFrom,
        currentTerm: term ? term.name : null,
      } as any)
      ctx.count('groups')
      if (head) { await groups.upsertMembership({ groupId: g.id, personId: (head as any).id, role: 'Coach', roles: ['coach'], termId: term ? term.id : null } as any); ctx.count('memberships') }
      if (enrol) {
        for (const m of ctx.pickN(members, ctx.randInt(4, 10))) {
          await groups.upsertMembership({ groupId: g.id, personId: (m as any).id, role: null, roles: [], termId: term ? term.id : null } as any)
          ctx.count('memberships')
        }
      }
      return g
    }

    for (let i = 0; i < plans.length; i++) {
      const pl = plans[i]
      const lineageId = ctx.id()
      const base = await makeClass(pl, termForBase, lineageId, i, true, null)
      // For roughly half the classes, roll the SAME class into the next term (same
      // lineage) with a lighter roster — a ready-made term-transfer test case.
      if (acrossTerms && termForRoll && ctx.chance(0.5)) {
        await makeClass(pl, termForRoll, lineageId, i, ctx.chance(0.5), base.id)
      }
    }
  },
}

const eventsBlock: SeedBlock = {
  key: 'events',
  label: 'Events',
  description: 'Categories plus events with sessions across the calendar.',
  orgKinds: ['club', 'governing'],
  options: [{ key: 'count', label: 'How many events', type: 'number', default: 10 }],
  async run(ctx, opts) {
    const n = Math.max(1, Math.min(60, Number(opts.count ?? 10)))
    const { events } = ctx.repos
    const categoryDefs = [
      { name: 'Training', color: '#3B82F6', icon: 'pi-bolt' },
      { name: 'Competition', color: '#EF4444', icon: 'pi-trophy' },
      { name: 'Social', color: '#8B5CF6', icon: 'pi-star' },
      { name: 'Community', color: '#10B981', icon: 'pi-users' },
    ]
    const catIds: string[] = []
    for (let i = 0; i < categoryDefs.length; i++) {
      const c = categoryDefs[i]
      const row = await events.createCategory({ orgId: ctx.orgId, name: c.name, color: c.color, icon: c.icon, sortOrder: i } as any)
      catIds.push(row.id); ctx.count('categories')
    }
    const EVENT_TITLES = ctx.flavour.events
    for (let i = 0; i < n; i++) {
      const dayOffset = ctx.randInt(-14, 45)
      const startHour = ctx.pick([9, 10, 13, 16, 18])
      const nSessions = ctx.pick([1, 1, 2, 3])
      const title = EVENT_TITLES[i % EVENT_TITLES.length] + (i >= EVENT_TITLES.length ? ` ${Math.floor(i / EVENT_TITLES.length) + 1}` : '')
      const ev = await events.createEvent({
        orgId: ctx.orgId, title, description: 'An event for the whole club.', style: 'PUBLISHED', status: 'PUBLISHED', isPublic: true,
        categoryId: ctx.pick(catIds), startAt: ctx.dayIso(dayOffset, startHour), endAt: ctx.dayIso(dayOffset, startHour + 2),
      } as any)
      ctx.count('events')
      for (let s = 0; s < nSessions; s++) {
        await events.createSession({
          eventId: ev.id, title: nSessions > 1 ? `Session ${s + 1}` : title,
          startAt: ctx.dayIso(dayOffset + s, startHour), endAt: ctx.dayIso(dayOffset + s, startHour + 2),
          capacityMax: ctx.pick([20, 30, 40, null]), sortOrder: s, isMaster: s === 0,
        } as any)
        ctx.count('sessions')
      }
    }
  },
}

const venuesBlock: SeedBlock = {
  key: 'venues',
  label: 'Venues & activities',
  description: 'A facility with named courts, activities, availability and a few sample bookings.',
  orgKinds: ['club'],
  async run(ctx) {
    const { bookings } = ctx.repos
    const orgId = ctx.orgId
    const v = ctx.flavour.venue
    const hall = await bookings.createBookable({
      orgId, name: v.facility, type: 'VENUE', status: 'ACTIVE', isPublic: true,
      description: 'The club’s main facility.', sortOrder: 0, allowSubVenues: true, defaultBookingView: 'scheduler',
    } as any)
    ctx.count('venues')
    const courtIds: string[] = []
    for (let i = 0; i < v.areas.length; i++) {
      const c = await bookings.createBookable({ orgId, name: v.areas[i], type: 'VENUE', status: 'ACTIVE', isPublic: true, parentId: hall.id, sortOrder: i + 1 } as any)
      courtIds.push(c.id); ctx.count('venues')
    }
    for (const bid of courtIds) {
      await bookings.createAvailabilityRule({ bookableId: bid, name: 'Open hours', ruleType: 'AVAILABLE', daysOfWeek: [0, 1, 2, 3, 4, 5, 6], timeFrom: '08:00', timeTo: '21:00', isActive: true, color: '#10B981' } as any)
      ctx.count('availabilityRules')
    }
    const act = await bookings.createActivity({ orgId, name: v.activity, description: `Book ${v.facility}.`, color: '#F59E0B', bookingFlow: 'scheduler', bookingsEnabled: true, status: 'ACTIVE' } as any)
    ctx.count('activities')
    await bookings.addActivityBookables(act.id, courtIds)
    for (const m of v.modes) {
      await bookings.createActivityMode({ activityId: act.id, name: m.name, pricing: { price: m.price } } as any)
      ctx.count('activityModes')
    }
    for (let i = 0; i < 10; i++) {
      const hour = ctx.pick([8, 9, 12, 15, 17, 18, 19])
      const dayOffset = ctx.randInt(-3, 12)
      await bookings.createBooking({
        orgId, bookableId: ctx.pick(courtIds), activityId: act.id, type: 'BOOKING', status: 'CONFIRMED',
        startAt: ctx.dayIso(dayOffset, hour), endAt: ctx.dayIso(dayOffset, hour + 1),
        contactName: `${ctx.pick(FIRST)} ${ctx.pick(LAST)}`,
      } as any)
      ctx.count('bookings')
    }
  },
}

const formsBlock: SeedBlock = {
  key: 'forms',
  label: 'Registration forms',
  description: 'An event registration form and a programme enquiry form.',
  orgKinds: ['club'],
  async run(ctx) {
    const { forms } = ctx.repos
    await forms.createForm({ orgId: ctx.orgId, name: 'Event Registration', config: { groups: [], groupProfiles: [{ key: 'member', label: 'Member', min: 1, max: 1, kind: 'person' }], groupFields: {} } } as any)
    ctx.count('forms')
    await forms.createForm({ orgId: ctx.orgId, name: 'Programme Enquiry', config: { groups: [], groupProfiles: [{ key: 'parent', label: 'Parent/Guardian', min: 1, max: 2, kind: 'person' }], groupFields: {} } } as any)
    ctx.count('forms')
  },
}

const disciplinesBlock: SeedBlock = {
  key: 'disciplines',
  label: 'Disciplines',
  description: 'A sport with a small discipline hierarchy (Seniors › Premiers › grades).',
  orgKinds: ['governing'],
  options: [{ key: 'sport', label: 'Sport name', type: 'text', default: '' }],
  async run(ctx, opts) {
    const { disciplines } = ctx.repos
    const sport = String(opts.sport || ctx.flavour.sport).trim() || ctx.flavour.sport
    const top = await disciplines.createDiscipline({ orgId: ctx.orgId, name: 'Seniors', sport, code: 'SNR', sortOrder: 0 } as any)
    ctx.count('disciplines')
    const mid = await disciplines.createDiscipline({ orgId: ctx.orgId, name: 'Premiers', sport, code: 'PRM', parentId: top.id, sortOrder: 0 } as any)
    ctx.count('disciplines')
    for (const g of ['A Grade', 'B Grade']) {
      await disciplines.createDiscipline({ orgId: ctx.orgId, name: g, sport, code: g.replace(/\s/g, '').toUpperCase(), parentId: mid.id, sortOrder: 0 } as any)
      ctx.count('disciplines')
    }
  },
}

// Registry — ORDER MATTERS: people before groups (groups enrol people), terms near
// the front. Run order = this order, filtered to the ticked blocks.
export const SEED_BLOCKS: SeedBlock[] = [
  personTypesBlock, peopleBlock, termsBlock, groupsBlock, eventsBlock, venuesBlock, formsBlock, disciplinesBlock,
]

export function blocksForKind(kind: OrgKind): SeedBlock[] {
  return SEED_BLOCKS.filter(b => b.orgKinds.includes(kind))
}

/** Run the chosen blocks (in registry order) into the org, merging their counts. */
export async function runBlocks(
  ctx: SeedContext,
  chosen: { key: string; options?: Record<string, any> }[],
): Promise<SeedSummary> {
  const byKey = new Map(chosen.map(c => [c.key, c.options ?? {}]))
  for (const block of SEED_BLOCKS) {
    if (!byKey.has(block.key)) continue
    await block.run(ctx, byKey.get(block.key)!)
    ctx.log(`block: ${block.key}`)
  }
  return { created: ctx.snapshotCounts(), orgIds: [ctx.orgId] }
}
