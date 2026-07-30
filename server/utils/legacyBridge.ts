/**
 * Answering for an event that lives in the OLD platform.
 *
 * A legacy event opens in the module's own screens — the run-the-event view, its
 * details summary, its attendance roll. Those components all read through the
 * `useEventsApi` seam, so the choice is: teach every component about the old
 * platform, or teach the SEAM to answer for a `legacy-` id and leave the UI alone.
 *
 * This is the second. Nothing above the seam knows there are two systems, which is
 * the same reason the merged category list works: one vocabulary, resolved at the
 * boundary.
 */
import { eq } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { legacyClub, legacy, legacyEventToFm, isLegacyId, legacyIdOf } from './legacy'

/** EventPerson.status over there → invitee status here. */
const STATUS_MAP: Record<number, string> = {
  [-1]: 'DECLINED',
  0: 'INVITED',
  1: 'CONFIRMED',   // attended
  2: 'INVITED',
  3: 'CONFIRMED',   // included
  4: 'CONFIRMED',
}

export { isLegacyId, legacyIdOf }

/**
 * The club's PEOPLE, from the system that owns them.
 *
 * The old platform is the source of truth for members — it has the real roster,
 * the contacts, the custom fields — and until now none of it reached this module,
 * so every picker offered our own seeded rows instead of the club's actual people.
 *
 * Mapped into the person contract with `legacy-` ids, exactly as venues and
 * categories are, so nothing above the seam has to know there are two systems.
 * Gender comes across as a word ("Female") and is normalised to the code the rest
 * of the app stores, or the profile and every gender filter would miss it.
 */
const GENDER_CODE: Record<string, string> = {
  male: 'MALE', female: 'FEMALE', 'non-binary': 'NON_BINARY', nonbinary: 'NON_BINARY',
}

function toPerson(p: any, orgId: string) {
  const g = String(p.gender ?? '').trim().toLowerCase()
  return {
    id: `${LEGACY_PERSON_PREFIX}${p.id}`,
    orgId,
    firstName: p.firstName ?? '',
    lastName: p.lastName ?? '',
    email: p.email ?? null,
    phone: p.phone ?? null,
    dob: p.dateOfBirth && !String(p.dateOfBirth).startsWith('0000') ? String(p.dateOfBirth) : null,
    gender: g ? (GENDER_CODE[g] ?? null) : null,
    membershipType: null,
    personTypes: [],
    personType: p.role ? String(p.role) : null,
    photoUrl: null,
    phone2: null,
    commsTopics: [],
    customFields: p.customFields ?? {},
    createdAt: null,
  }
}

export const LEGACY_PERSON_PREFIX = 'legacy-'
export const isLegacyPersonId = (id: string) => id.startsWith(LEGACY_PERSON_PREFIX)

/**
 * EVERY id that means this person. Use it for any lookup keyed on person_id.
 *
 * A bridged member has an id on each side — `legacy-610` over there, a uuid here —
 * and which one arrives depends on where the request came from. Their profile on
 * the old platform asks with the legacy id; rows written here are stored against
 * the uuid. Matching only the id you were handed silently finds nothing: the
 * Events tab reads "no events" and answering an invitation reads "this invitation
 * is no longer valid", while the row sits in the table under the other id.
 */
export async function personIdVariants(personId: string): Promise<string[]> {
  const ids = [personId]
  const legacyNum = /^legacy-(\d+)$/i.exec(personId)
  if (legacyNum) {
    // Their id → our rows for the same person.
    const bridged = await db.select({ id: schema.persons.id })
      .from(schema.persons).where(eq(schema.persons.legacyPersonId, Number(legacyNum[1])))
    for (const b of bridged) ids.push(b.id)
  } else {
    // Our id → their id, for rows written against the legacy side.
    const [row] = await db.select({ legacyPersonId: schema.persons.legacyPersonId })
      .from(schema.persons).where(eq(schema.persons.id, personId)).limit(1)
    if (row?.legacyPersonId) ids.push(`${LEGACY_PERSON_PREFIX}${row.legacyPersonId}`)
  }
  return [...new Set(ids)]
}

/**
 * Search the club's people. `q` is passed straight through — the old platform
 * matches name, email and phone, and does it against the whole roster rather than
 * a page of it, which a client-side filter over a truncated list could not.
 */
export async function legacyPeople(orgId: string, opts: { q?: string; limit?: number; offset?: number } = {}) {
  const club = legacyClub()
  if (!club) return []
  const res: any = await legacy.people(club, opts).catch(() => null)
  const rows: any[] = res?.people ?? (Array.isArray(res) ? res : [])
  return rows.map(p => toPerson(p, orgId))
}

/** One person, with the detail fields (address, role, custom fields) the summary lacks. */
export async function legacyPerson(id: string, orgId: string) {
  const club = legacyClub()
  if (!club) return null
  const pid = Number(String(id).replace(LEGACY_PERSON_PREFIX, ''))
  const res: any = await legacy.person(club, pid).catch(() => null)
  const p = res?.person ?? res
  return p ? toPerson(p, orgId) : null
}

/** One legacy event in this module's event shape, or null if it can't be reached. */
export async function legacyEvent(id: string, orgId: string) {
  const club = legacyClub()
  if (!club) return null
  // `legacy.event()` returns the event ITSELF. (Our own /api/v1/legacy/event route
  // wraps it as { event, attendance, fees } — unwrapping that shape here found
  // nothing and 404'd every legacy event.)
  const res: any = await legacy.event(club, legacyIdOf(id)).catch(() => null)
  const row = res?.event ?? res
  if (!row?.id) return null
  return legacyEventToFm(row, orgId, 'Friendly Manager')
}

/**
 * EDIT an event that lives in the old platform, from this module's screens.
 *
 * Mapped to the fields its own event form actually has — title, visibility,
 * location, start/end, invites-close, max attendees, fee, additional info,
 * coordinator, terms — so editing here changes the same things editing there
 * would, and nothing else.
 *
 * PARTIAL by construction: only keys present in the patch are sent. The old API
 * replaces categories and classes wholesale when given them and recomputes
 * visibility only when told to, so sending a field we weren't asked to change is
 * how you silently unlink an event's classes. Absent means untouched.
 *
 * Not mapped, deliberately: the banner (an image upload over there, not a value)
 * and anything this module has that they don't (forms, discounts, sessions).
 */
export async function legacyUpdateEvent(id: string, patch: Record<string, any>) {
  const club = legacyClub()
  if (!club) throw createError({ statusCode: 503, statusMessage: 'No legacy connection configured for this club.' })

  // Wall clock, no zone — send the local parts, not an ISO instant they'd read as
  // a different moment. `undefined` (not null) means "don't send this key".
  const d = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : undefined)
  const t = (iso?: string | null, allDay?: boolean) =>
    iso ? (allDay ? '00:00:00' : `${String(iso).slice(11, 16) || '00:00'}:00`) : undefined

  const body: Record<string, any> = { eventID: legacyIdOf(id) }
  if (patch.title !== undefined) body.name = patch.title
  if (patch.startAt !== undefined) {
    body.date = d(patch.startAt)
    body.startTime = t(patch.startAt, patch.isAllDay)
  }
  if (patch.endAt !== undefined) {
    body.endDate = d(patch.endAt)
    body.endTime = t(patch.endAt, patch.isAllDay)
  }
  if (patch.address !== undefined) body.location = patch.address ?? ''
  if (patch.description !== undefined) body.notes = patch.description ?? ''
  if (patch.capacityMax !== undefined) body.maxAttendees = Number(patch.capacityMax) || 0
  if (patch.regCloseAt !== undefined) body.closeDate = d(patch.regCloseAt) ?? ''
  if (patch.tcContent !== undefined) body.terms = patch.tcContent ?? ''
  if (patch.isPublic !== undefined) body.isPublic = !!patch.isPublic
  // Their categories, by their ids — a `legacy-3` from the merged list is theirs.
  if (patch.categoryIds !== undefined) {
    body.categoryIDs = (patch.categoryIds ?? [])
      .map((c: any) => Number(String(c).replace(LEGACY_PERSON_PREFIX, '')))
      .filter(Boolean)
  }

  await legacy.saveEvent(club, body)
  return await legacyEvent(id, club.orgId!)
}

/**
 * The event's COORDINATOR, as a coordinator row.
 *
 * The old platform's event form has exactly one (its `personID`), and shows it on
 * every event — so this module has to be able to as well, or a legacy event looks
 * like nobody owns it. Ours is a list, theirs is a single person, so this returns
 * a list of one and the summary card renders it without knowing the difference.
 *
 * `notifications` is empty because that setting lives over there (the form's
 * Notifications dropdown) and isn't ours to report as on.
 */
export async function legacyCoordinators(id: string) {
  const club = legacyClub()
  if (!club) return []
  const res: any = await legacy.event(club, legacyIdOf(id)).catch(() => null)
  const row = res?.event ?? res
  const c = row?.coordinator
  if (!c?.id) return []
  return [{
    id: `${LEGACY_PERSON_PREFIX}${row.id}-${c.id}`,
    eventId: id,
    personId: `${LEGACY_PERSON_PREFIX}${c.id}`,
    notifications: [] as string[],
    person: { id: `${LEGACY_PERSON_PREFIX}${c.id}`, firstName: c.firstName ?? null, lastName: c.lastName ?? null },
    createdAt: null,
  }]
}

/**
 * The roll, in the shape the attendance table expects.
 *
 * `attended` is what the roll ticks, and over there it IS the status (1 = attended)
 * rather than a separate flag — so it's derived, not invented. The ids are the
 * legacy person ids, prefixed, because the roll uses them as keys and they must not
 * collide with ours.
 */
export async function legacyInviteesWithPerson(id: string) {
  const club = legacyClub()
  if (!club) return []
  const rows: any[] = await legacy.attendance(club, legacyIdOf(id)).catch(() => [])
  return (rows ?? []).map((r: any) => {
    const status = Number(r.status)
    const [first, ...rest] = String(r.name || '').trim().split(/\s+/)
    return {
      // The invitee id carries BOTH ids: over there attendance is keyed by
      // (event, person), and PATCH /invitees/:id is handed only this. Without the
      // event in it there is nothing to write against.
      id: `legacy-${legacyIdOf(id)}-${r.personID}`,
      eventId: id,
      sessionId: null,
      personId: `${LEGACY_PERSON_PREFIX}${r.personID}`,
      status: STATUS_MAP[status] ?? 'INVITED',
      attended: status === 1,
      signedOut: !!r.signedOutTime,
      roles: [],
      role: null,
      subGroupId: null,
      invitedAt: null,
      respondedAt: null,
      // The old platform doesn't record WHEN an invitation was emailed, only that
      // the person is invited — so this stays null rather than inventing a time.
      inviteSentAt: null,
      clubOrgId: null,
      invitedViaGroupId: null,
      person: {
        id: `${LEGACY_PERSON_PREFIX}${r.personID}`,
        // firstName/lastName come from the person row now; splitting the display
        // name on whitespace was only ever a guess ("Anna Maria van der Berg").
        firstName: r.firstName ?? (first || String(r.name || '')),
        lastName: r.lastName ?? rest.join(' '),
        email: r.email ?? null,
        phone: r.phone ?? null,
        phone2: null,
        dateOfBirth: r.dateOfBirth ?? null,
        gender: r.gender ? (GENDER_CODE[String(r.gender).trim().toLowerCase()] ?? null) : null,
        membershipType: null,
        photoUrl: null,
        // The club's OWN custom fields, keyed by their field name — which is what
        // the roll's custom columns read.
        customFields: r.customFields ?? {},
      },
    }
  })
}

/**
 * One person's events, as invitee rows — what the profile's Events tab lists.
 *
 * The old platform answers "what is this member on" itself, including attendance we
 * never see, so for one of its people that answer has to come from there. Mapped to
 * the same shape our own rows use (with the event's title, start and status folded
 * in) so the list renders both without knowing which system a row came from.
 */
export async function legacyInviteesForPerson(personId: string) {
  const club = legacyClub()
  if (!club || !isLegacyPersonId(personId)) return []
  const pid = Number(personId.slice(LEGACY_PERSON_PREFIX.length))
  const rows: any[] = await legacy.personEvents(club, pid).catch(() => [])
  return (rows ?? []).filter((e: any) => e?.id).map((e: any) => {
    const status = Number(e.attendanceStatus ?? e.status ?? 0)
    return {
      id: `${LEGACY_PERSON_PREFIX}${e.id}-${pid}`,
      eventId: `${LEGACY_ID_PREFIX}${e.id}`,
      sessionId: null,
      personId,
      status: STATUS_MAP[status] ?? 'INVITED',
      attended: status === 1,
      signedOut: false,
      roles: [] as string[],
      role: null,
      subGroupId: null,
      invitedAt: null,
      respondedAt: null,
      inviteSentAt: null,
      clubOrgId: null,
      invitedViaGroupId: null,
      eventTitle: e.name || 'Untitled',
      eventStartAt: e.date && !String(e.date).startsWith('0000')
        ? `${e.date}T${e.startTime && e.startTime !== '00:00:00' ? e.startTime : '00:00:00'}`
        : null,
      // The END too. The profile calendar sizes a block from end − start, and the
      // contract requires this key — a legacy row without it fails validation, which
      // takes down the WHOLE tab, our events and theirs alike. They keep endDate and
      // endTime separately; with no end recorded, fall back to the start.
      eventEndAt: e.endDate && !String(e.endDate).startsWith('0000')
        ? `${e.endDate}T${e.endTime && e.endTime !== '00:00:00' ? e.endTime : '00:00:00'}`
        : (e.date && !String(e.date).startsWith('0000')
            ? `${e.date}T${e.endTime && e.endTime !== '00:00:00' ? e.endTime : (e.startTime || '00:00:00')}`
            : null),
      eventStatus: 'PUBLISHED',
    }
  })
}

/**
 * REGISTER one of this module's events in the old platform.
 *
 * A club running embedded keeps ONE calendar — theirs. Their calendar, member
 * timelines and reports are all built from `Event` rows over there, so an event
 * created here has to exist there too or it's invisible everywhere the club
 * already looks. It's also what gives their mailer something to send about.
 *
 * Idempotent by construction: the old API creates when given no id and updates
 * when given one, so the caller stores the returned id on our row and hands it
 * back next time. Without that, every save would make another event.
 *
 * BEST-EFFORT — returns null instead of throwing. The old platform being
 * unreachable must never fail saving an event in this one; the mirror can be
 * caught up later, a lost event cannot.
 */
export async function registerEventInLegacy(ev: {
  legacyEventId?: number | null
  title?: string | null
  startAt?: string | null
  endAt?: string | null
  isAllDay?: boolean | null
  address?: string | null
  description?: string | null
  capacityMax?: number | null
  isPublic?: boolean | null
  /** What it costs, and where the money is coded. See the note in the body. */
  fee?: number | null
  account?: string | null
  feeDue?: string | null
}): Promise<number | null> {
  const club = legacyClub()
  if (!club || !ev.startAt) return null

  // Wall clock, no zone — that's how the old platform stores times, so send the
  // local parts rather than an ISO instant it would read as a different moment.
  const d = (iso: string) => iso.slice(0, 10)
  const t = (iso: string) => (ev.isAllDay ? '00:00:00' : `${iso.slice(11, 16) || '00:00'}:00`)

  const body: Record<string, any> = {
    name: ev.title || 'Untitled',
    date: d(ev.startAt),
    startTime: t(ev.startAt),
    endDate: d(ev.endAt || ev.startAt),
    endTime: t(ev.endAt || ev.startAt),
    location: ev.address || '',
    notes: ev.description || '',
    maxAttendees: ev.capacityMax ?? 0,
    isPublic: !!ev.isPublic,
  }
  // WHAT IT COSTS — carried so the club can invoice for it with its own tools.
  //
  // We deliberately do NOT create the invoices. Charging over there is a staff
  // action per attendee that also applies the member's existing credit, emails the
  // invoice and pushes it to Xero (post/manager/event.php, action=applyfee).
  // Creating a bare Fee row from here would skip all three and leave the club with
  // invoices nobody was sent and Xero never saw. So the price travels with the
  // event, and raising the money stays theirs.
  if (ev.fee != null) body.fee = ev.fee
  if (ev.account) body.account = ev.account
  if (ev.feeDue) body.feeDue = ev.feeDue
  if (ev.legacyEventId) body.eventID = ev.legacyEventId

  const res: any = await legacy.saveEvent(club, body).catch((e: any) => {
    console.warn('[legacy] could not register the event on the club\'s calendar:', e?.message || e)
    return null
  })
  return res?.eventID ?? null
}

/**
 * Put this module's invitees onto the mirrored event over there.
 *
 * Only people the old platform actually knows can go — a person created in this
 * module has no record there, so they're skipped rather than guessed at. That is
 * why bridging people matters: once invitees ARE the club's own people, this
 * carries all of them.
 *
 * Best-effort, same reasoning as the registration above.
 */
export async function pushInviteesToLegacy(legacyEventId: number, personIds: string[]) {
  const club = legacyClub()
  if (!club || !legacyEventId) return { pushed: 0 }
  const entries = personIds
    .filter(isLegacyPersonId)
    .map(pid => ({ personID: Number(pid.replace(LEGACY_PERSON_PREFIX, '')), status: 0 }))  // 0 = invited
  if (!entries.length) return { pushed: 0 }
  const res: any = await legacy.saveAttendance(club, legacyEventId, entries).catch((e: any) => {
    console.warn('[legacy] could not push invitees:', e?.message || e)
    return null
  })
  const ok = (res?.results ?? []).filter((r: any) => r.ok !== false).length
  return { pushed: ok }
}

/**
 * THE MEMBER THE INVOICE HANGS OFF — find them over there, or create them.
 *
 * An invoice in their books requires a `personID`; there is no such thing as a
 * charge with nobody attached. So anyone who registers has to exist over there
 * first — including a stranger off the public form who has never been a member.
 *
 * The matching rule, and why:
 *   exactly one email match → that's them
 *   no match               → create them
 *   several matches        → CREATE, and say so
 *
 * That last case is the careful one. `POST /person` deliberately never merges on
 * email, and their own note says why: families share an address and duplicates
 * exist, so "merging a registration onto the wrong member is worse than asking".
 * Picking one of several would be exactly that guess. A duplicate member is
 * annoying and mergeable by hand; money on the wrong person's account is not.
 *
 * The answer is cached on our row, so this is one lookup per person ever rather
 * than one per registration.
 */
export async function ensureLegacyPerson(ourPersonId: string): Promise<{ id: number | null; ambiguous?: boolean }> {
  const club = legacyClub()
  if (!club) return { id: null }

  // Already one of theirs (bridged in from their roster) — nothing to resolve.
  if (isLegacyPersonId(ourPersonId)) {
    return { id: Number(ourPersonId.slice(LEGACY_PERSON_PREFIX.length)) }
  }

  const [p] = await db.select().from(schema.persons)
    .where(eq(schema.persons.id, ourPersonId)).limit(1)
  if (!p) return { id: null }
  if (p.legacyPersonId) return { id: p.legacyPersonId }

  let theirId: number | null = null
  let ambiguous = false

  if (p.email) {
    const found: any = await legacy.personByEmail(club, p.email).catch(() => null)
    const matches: any[] = found?.people ?? (Array.isArray(found) ? found : [])
    if (matches.length === 1) theirId = Number(matches[0].id)
    else if (matches.length > 1) ambiguous = true
  }

  if (!theirId) {
    const created: any = await legacy.savePerson(club, {
      firstName: p.firstName ?? '',
      lastName: p.lastName ?? '',
      email: p.email ?? null,
      phone: p.phone ?? null,
      dateOfBirth: p.dob ?? null,
      gender: p.gender ?? null,
    }).catch((e: any) => {
      console.warn('[legacy] could not create the member:', e?.message || e)
      return null
    })
    theirId = created?.personID ?? null
    if (ambiguous && theirId) {
      console.warn(`[legacy] ${p.email} matched several members — created #${theirId} rather than guessing. Needs merging by hand.`)
    }
  }

  if (theirId) {
    await db.update(schema.persons).set({ legacyPersonId: theirId })
      .where(eq(schema.persons.id, ourPersonId))
  }
  return { id: theirId, ambiguous }
}

/**
 * Move somebody's status on the club's own roll.
 *
 * Invitees were pushed across when they were ADDED and never again — so accepting
 * an invitation here left them sitting at "invited" over there, which is where the
 * club actually looks. Statuses are theirs, not ours: -1 declined, 1 attended,
 * 2 invited, 4 confirmed.
 */
const OUR_STATUS_TO_THEIRS: Record<string, number> = {
  CONFIRMED: 4, DECLINED: -1, INVITED: 2, ATTENDED: 1,
}
export async function setLegacyAttendeeStatus(eventId: string, personId: string, status: string) {
  const club = legacyClub()
  const theirs = OUR_STATUS_TO_THEIRS[status]
  if (!club || theirs === undefined) return
  // Anyone, not just somebody bridged in from their roster — a public registrant
  // has to appear on the club's roll too, or the club can't see who is coming.
  const { id: theirPersonId } = await ensureLegacyPerson(personId)
  if (!theirPersonId) return
  let legacyEventId: number | null = null
  if (isLegacyId(eventId)) legacyEventId = legacyIdOf(eventId)
  else {
    const [row] = await db.select({ legacyEventId: schema.events.legacyEventId })
      .from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    legacyEventId = row?.legacyEventId ?? null
  }
  if (!legacyEventId) return
  await legacy.saveAttendance(club, legacyEventId, [
    { personID: theirPersonId, status: theirs },
  ]).catch((e: any) => console.warn('[legacy] could not update their roll:', e?.message || e))
}

/**
 * SOMEONE SAID YES — raise their invoice in the club's own books.
 *
 * NB this is a NEW behaviour, not a port of one: in FriendlyManager, charging has
 * always been a staff action (`action=applyfee`) and accepting an invitation never
 * invoiced anybody. Doing it on acceptance is a deliberate change, so it is
 * deliberately narrow — everything below has to be true or nothing happens.
 *
 * Safe to call more than once: their endpoint refuses to charge the same person
 * twice for the same event (`$ep->fee()`), which is what makes a retried
 * registration, a double-click, or a re-confirm harmless.
 *
 * The AMOUNT is deliberately not sent. The event over there already carries its
 * own fee and account (we mirror both), and letting the club's own record of the
 * price win means our two systems can't disagree about what someone owes.
 *
 * Best-effort: an unreachable platform must never stop somebody signing up. The
 * charge is recoverable by hand; a refused registration is a lost member.
 */
export async function chargeAttendeeInLegacy(eventId: string, personId: string) {
  const club = legacyClub()
  if (!club) return { charged: false, reason: 'no legacy connection' }
  // EVERYONE gets an invoice — a club member accepting, and a stranger off the
  // public form alike. Their books have no concept of a charge with nobody
  // attached, so the member is resolved (or created) first.
  const { id: theirPersonId } = await ensureLegacyPerson(personId)
  if (!theirPersonId) return { charged: false, reason: 'could not resolve the member' }

  // Which event over there? Either this IS one of theirs, or it's one of ours that
  // has been mirrored — an unmirrored event has nothing to charge against.
  let legacyEventId: number | null = null
  if (isLegacyId(eventId)) legacyEventId = legacyIdOf(eventId)
  else {
    const [row] = await db.select({ legacyEventId: schema.events.legacyEventId })
      .from(schema.events).where(eq(schema.events.id, eventId)).limit(1)
    legacyEventId = row?.legacyEventId ?? null
  }
  if (!legacyEventId) {
    // Since events stopped being mirrored, this is the NORMAL path for anything
    // created here — so it is logged rather than returned quietly. An uninvoiced
    // registration that nobody is told about is the exact failure mode this
    // codebase keeps producing: it looks like everything worked.
    console.warn(
      `[legacy] NOT INVOICED — event ${eventId} has no counterpart on the club's calendar, `
      + `so there is nothing to charge person ${theirPersonId} against. `
      + `(Events are no longer mirrored; see MIRROR_EVENTS_TO_LEGACY.)`,
    )
    return { charged: false, reason: 'event not on the club calendar' }
  }

  const res: any = await legacy.charge(club, {
    eventID: legacyEventId,
    personID: theirPersonId,
  }).catch((e: any) => {
    console.warn('[legacy] could not raise the invoice:', e?.message || e)
    return null
  })
  if (!res) return { charged: false, reason: 'the club\'s system could not be reached' }
  // `created: false` is the normal, healthy answer for "already charged" or "nothing
  // to charge" — reported, not treated as a failure.
  return { charged: !!res.created, feeId: res.feeID ?? null, reason: res.reason ?? null }
}

/**
 * Write one person's attendance back. The old platform takes a BATCH with
 * per-entry results, so a partial failure is visible rather than silently losing
 * somebody — we send one and check that one came back ok.
 */
export async function legacySetAttendance(inviteeId: string, attended: boolean) {
  const club = legacyClub()
  if (!club) throw createError({ statusCode: 503, statusMessage: 'No legacy connection configured for this club.' })
  const m = /^legacy-(\d+)-(\d+)$/.exec(inviteeId)
  if (!m) throw createError({ statusCode: 400, statusMessage: 'not a legacy invitee id' })
  const [, eid, pidStr] = m
  const pid = Number(pidStr)
  const res: any = await legacy.saveAttendance(club, Number(eid), [
    { personID: pid, status: attended ? 1 : 0 },
  ])
  const row = (res?.results ?? []).find((r: any) => Number(r.personID) === pid)
  if (row && row.ok === false) {
    throw createError({ statusCode: 502, statusMessage: `Legacy API: ${row.error || 'attendance not saved'}` })
  }
  return { ok: true }
}
