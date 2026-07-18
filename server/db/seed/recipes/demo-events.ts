// Recipe: a well-populated demo club, seeded through the repositories into an
// EXISTING org. Faithful in spirit to the old in-page seedDemoEvents (venues,
// activities+modes, ~10 events with sessions, a couple of forms, discounts) — not a
// line-by-line port. Every top-level entity name is prefixed "[Demo] " so a reset
// or a human can spot + sweep them.
import type { SeedRecipe } from '../types'

const D = '[Demo] '

export const demoEventsRecipe: SeedRecipe = {
  key: 'demo-events',
  label: 'Demo club data',
  description: 'Populate this club with sample venues, activities, ~10 events with sessions, a couple of registration forms and some discounts. Everything is prefixed "[Demo]".',
  scope: 'org',
  options: [
    { key: 'events', label: 'Number of events', type: 'number', default: 10 },
  ],

  async run(ctx, opts) {
    const orgId = ctx.orgId
    const { events, bookings, forms, finances, people } = ctx.repos
    const wantEvents = Math.max(1, Math.min(40, Number(opts?.events ?? 10)))

    // ── Categories ────────────────────────────────────────────────
    const categoryDefs = [
      { name: 'Training', color: '#3B82F6', icon: 'pi-bolt' },
      { name: 'Competition', color: '#EF4444', icon: 'pi-trophy' },
      { name: 'Social', color: '#8B5CF6', icon: 'pi-star' },
      { name: 'Community', color: '#10B981', icon: 'pi-users' },
      { name: 'Development', color: '#F59E0B', icon: 'pi-graduation-cap' },
    ]
    const cat: Record<string, string> = {}
    for (let i = 0; i < categoryDefs.length; i++) {
      const c = categoryDefs[i]
      const row = await events.createCategory({ orgId, name: c.name, color: c.color, icon: c.icon, sortOrder: i } as any)
      cat[c.name] = row.id
      ctx.count('categories')
    }

    // ── Coaches (persons) — reused, not duplicated on re-seed ──────
    const coachDefs = [
      { firstName: 'James', lastName: 'Carter', email: 'james.carter@demo.local' },
      { firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah.mitchell@demo.local' },
    ]
    const coachIds: string[] = []
    for (const c of coachDefs) {
      let p = await people.findPersonByEmail(orgId, c.email)
      if (!p) {
        p = await people.createPerson({ orgId, firstName: c.firstName, lastName: c.lastName, email: c.email } as any)
        ctx.count('people')
      }
      coachIds.push(p.id)
    }

    // ── Venues ─────────────────────────────────────────────────────
    const clubRooms = await bookings.createBookable({
      orgId, name: D + 'Club Rooms', type: 'VENUE', status: 'ACTIVE', isPublic: true,
      description: 'Function space for meetings, presentations and social events.', sortOrder: 0,
    } as any)
    ctx.count('venues')

    const footballFields = await bookings.createBookable({
      orgId, name: D + 'Football Fields', type: 'VENUE', status: 'ACTIVE', isPublic: true,
      description: 'Full-size football fields for training and match play.',
      parentId: clubRooms.id, sortOrder: 1, allowSubVenues: true, defaultBookingView: 'scheduler',
    } as any)
    ctx.count('venues')

    const field1 = await bookings.createBookable({
      orgId, name: 'Field 1', type: 'VENUE', status: 'ACTIVE', isPublic: true, isMaster: true,
      parentId: footballFields.id, sortOrder: 0, autoResolveChildren: true,
    } as any)
    ctx.count('venues')
    const field2 = await bookings.createBookable({
      orgId, name: 'Field 2', type: 'VENUE', status: 'ACTIVE', isPublic: true, masterId: field1.id,
      parentId: footballFields.id, sortOrder: 1, autoResolveChildren: true,
    } as any)
    ctx.count('venues')

    const tennisCourts = await bookings.createBookable({
      orgId, name: D + 'Tennis Courts', type: 'VENUE', status: 'ACTIVE', isPublic: true,
      description: 'Hard courts available for hire and coaching.', sortOrder: 2, allowSubVenues: true,
      defaultBookingView: 'scheduler',
    } as any)
    ctx.count('venues')
    const courtIds: string[] = []
    for (let i = 1; i <= 3; i++) {
      const c = await bookings.createBookable({
        orgId, name: `Court ${i}`, type: 'VENUE', status: 'ACTIVE', isPublic: true,
        parentId: tennisCourts.id, sortOrder: i,
      } as any)
      courtIds.push(c.id)
      ctx.count('venues')
    }

    // ── Availability — open every day on each court + the fields ────
    const openRule = (bookableId: string, name: string) => ({
      bookableId, name, ruleType: 'AVAILABLE', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      timeFrom: '08:00', timeTo: '21:00', isActive: true, color: '#10B981',
    })
    for (const bid of [field1.id, field2.id, ...courtIds]) {
      await bookings.createAvailabilityRule(openRule(bid, 'Open hours') as any)
      ctx.count('availabilityRules')
    }

    // ── Activities + modes ─────────────────────────────────────────
    const football = await bookings.createActivity({
      orgId, name: D + 'Football Training', description: 'Coached football sessions.',
      color: '#3B82F6', bookingFlow: 'scheduler', bookingsEnabled: true, status: 'ACTIVE',
    } as any)
    ctx.count('activities')
    await bookings.addActivityBookables(football.id, [field1.id, field2.id])
    for (const m of [
      { name: 'Small-sided game', pricing: { price: 12 } },
      { name: 'Full team training', pricing: { price: 18 } },
    ]) {
      await bookings.createActivityMode({ activityId: football.id, name: m.name, pricing: m.pricing } as any)
      ctx.count('activityModes')
    }

    const tennis = await bookings.createActivity({
      orgId, name: D + 'Tennis Court Hire', description: 'Hire a hard court by the hour.',
      color: '#F59E0B', bookingFlow: 'scheduler', bookingsEnabled: true, status: 'ACTIVE',
    } as any)
    ctx.count('activities')
    await bookings.addActivityBookables(tennis.id, courtIds)
    for (const m of [
      { name: 'Singles', pricing: { price: 20 } },
      { name: 'Doubles', pricing: { price: 28 } },
    ]) {
      await bookings.createActivityMode({ activityId: tennis.id, name: m.name, pricing: m.pricing } as any)
      ctx.count('activityModes')
    }

    // ── Registration forms (a basic one + a programme enquiry) ─────
    const regForm = await forms.createForm({
      orgId, name: D + 'Event Registration', config: {
        groups: [], groupProfiles: [{ key: 'member', label: 'Member', min: 1, max: 1, kind: 'person' }],
        groupFields: {},
      },
    } as any)
    ctx.count('forms')
    const enquiryForm = await forms.createForm({
      orgId, name: D + 'Programme Enquiry', config: {
        groups: [], groupProfiles: [{ key: 'parent', label: 'Parent/Guardian', min: 1, max: 2, kind: 'person' }],
        groupFields: {},
      },
    } as any)
    ctx.count('forms')

    // ── Events (with a session or two each) ────────────────────────
    const eventTemplates = [
      { title: 'Friday Night Training', cat: 'Training', style: 'PUBLISHED', sessions: 1 },
      { title: 'Junior Skills Clinic', cat: 'Development', style: 'PUBLISHED', sessions: 2, form: regForm.id },
      { title: 'Club Championships', cat: 'Competition', style: 'PUBLISHED', sessions: 3, form: regForm.id },
      { title: 'End of Season Social', cat: 'Social', style: 'PUBLISHED', sessions: 1 },
      { title: 'Open Morning', cat: 'Community', style: 'PUBLISHED', sessions: 1, form: enquiryForm.id },
      { title: 'Weekend Tournament', cat: 'Competition', style: 'PUBLISHED', sessions: 2, form: regForm.id },
      { title: 'Coaching Workshop', cat: 'Development', style: 'PUBLISHED', sessions: 1 },
      { title: 'Family Fun Day', cat: 'Social', style: 'PUBLISHED', sessions: 1 },
      { title: 'Pre-season Camp', cat: 'Training', style: 'PUBLISHED', sessions: 3, form: regForm.id },
      { title: 'AGM & Awards Night', cat: 'Community', style: 'PUBLISHED', sessions: 1 },
    ]
    const createdEventIds: string[] = []
    for (let i = 0; i < wantEvents; i++) {
      const t = eventTemplates[i % eventTemplates.length]
      const dayOffset = ctx.randInt(-14, 45)
      const startHour = ctx.pick([9, 10, 13, 16, 18])
      const ev = await events.createEvent({
        orgId, title: D + t.title + (i >= eventTemplates.length ? ` (${i + 1})` : ''),
        description: `A ${t.cat.toLowerCase()} event for the whole club.`,
        style: t.style, status: 'PUBLISHED', isPublic: true,
        categoryId: cat[t.cat] ?? null, formId: t.form ?? null,
        startAt: ctx.dayIso(dayOffset, startHour),
        endAt: ctx.dayIso(dayOffset, startHour + 2),
      } as any)
      createdEventIds.push(ev.id)
      ctx.count('events')

      // Sessions — one master + subsequent occurrences.
      for (let s = 0; s < t.sessions; s++) {
        await events.createSession({
          eventId: ev.id, title: t.sessions > 1 ? `Session ${s + 1}` : t.title,
          startAt: ctx.dayIso(dayOffset + s, startHour),
          endAt: ctx.dayIso(dayOffset + s, startHour + 2),
          capacityMax: ctx.pick([20, 30, 40, null]),
          sortOrder: s, isMaster: s === 0,
        } as any)
        ctx.count('sessions')
      }
    }

    // ── Discounts (event-level) ────────────────────────────────────
    const firstFormEvent = createdEventIds[1] ?? createdEventIds[0]
    for (const disc of [
      { name: 'Early Bird', modifierType: 'PERCENT', modifierValue: 10 },
      { name: 'Sibling Discount', modifierType: 'PERCENT', modifierValue: 15 },
      { name: 'Member Rate', modifierType: 'FLAT', modifierValue: 5 },
    ]) {
      await finances.createDiscount({
        eventId: firstFormEvent, name: D + disc.name, type: 'EVENT',
        modifierType: disc.modifierType, modifierValue: disc.modifierValue,
        applyTo: 'registration_total', isActive: true,
      } as any)
      ctx.count('discounts')
    }

    // ── A handful of bookings so calendars aren't empty ────────────
    for (let i = 0; i < 8; i++) {
      const court = ctx.pick(courtIds)
      const dayOffset = ctx.randInt(-3, 10)
      const hour = ctx.pick([8, 9, 12, 15, 17, 19])
      await bookings.createBooking({
        orgId, bookableId: court, activityId: tennis.id, type: 'BOOKING', status: 'CONFIRMED',
        startAt: ctx.dayIso(dayOffset, hour), endAt: ctx.dayIso(dayOffset, hour + 1),
        contactName: ctx.pick(['Alex Rivera', 'Sam Okoro', 'Jamie Lee', 'Pat Chen']),
      } as any)
      ctx.count('bookings')
    }

    ctx.log(`Seeded ${wantEvents} events into org ${orgId}`)
    return { created: ctx.snapshotCounts(), orgIds: [orgId] }
  },
}
