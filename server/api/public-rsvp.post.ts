import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { onAttendeeConfirmed } from '../db/repositories/events'
import { personIdVariants } from '../utils/legacyBridge'

/**
 * Event RSVP — the yes/no answer to an invitation.
 *
 * This is deliberately NOT a form submission. "Are you coming?" is the invitee's
 * own status (invitees.status), which has carried CONFIRMED/DECLINED since the
 * first schema and was never written by anything until now. A registration form
 * is the opt-in layer for when the club needs to ask MORE than yes/no.
 *
 * The link arrives by email, so the responder is anonymous: service-role client,
 * like public-booking / public-form-submit. The (event, person) pair IS the
 * credential — you can only answer for an invitee row that already exists, so a
 * stranger can't RSVP their way onto an event they were never invited to.
 *
 * Called with no `response` it just LOADS the invitation (so the page can render
 * who/what before they answer); with one it records the answer.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { eventId, personId, response } = body as {
    eventId: string
    personId: string
    response?: 'yes' | 'no'
  }

  if (!eventId || !personId) throw createError({ statusCode: 400, message: 'Missing invitation' })
  if (response && response !== 'yes' && response !== 'no') {
    throw createError({ statusCode: 400, message: 'Answer must be yes or no' })
  }

  // Reads and writes through the MySQL seam, the same backend the events themselves
  // live in. On Supabase this answered every real invitation with "no longer valid",
  // because the invitee row it was looking for was in the other database.
  //
  // The invitation must already exist — this endpoint answers an invite, it never
  // creates one. A missing row means the link is bogus or the invite was pulled.
  // Either id may arrive — the profile on the old platform answers as `legacy-610`,
  // while the invitee row is stored against our uuid for the same person.
  const personIds = await personIdVariants(personId)
  const [invitee] = await db.select({
    id: schema.invitees.id, status: schema.invitees.status, respondedAt: schema.invitees.respondedAt,
    personId: schema.invitees.personId,
  }).from(schema.invitees)
    .where(and(eq(schema.invitees.eventId, eventId), inArray(schema.invitees.personId, personIds)))
    .limit(1)
  if (!invitee) throw createError({ statusCode: 404, message: 'This invitation is no longer valid.' })

  // NB `locations` (json array, migration 004) — there is no `location` column.
  const [[ev], [person]] = await Promise.all([
    db.select({
      id: schema.events.id, title: schema.events.title, startAt: schema.events.startAt,
      endAt: schema.events.endAt, status: schema.events.status, locations: schema.events.locations,
      address: schema.events.address, formId: schema.events.formId,
      // What they're actually being asked to come to. Answering "are you going?"
      // off a title and a date alone is answering blind.
      description: schema.events.description, bannerUrl: schema.events.bannerUrl,
    }).from(schema.events).where(eq(schema.events.id, eventId)).limit(1),
    // Look the person up by the id the INVITEE ROW holds, not the one the caller
    // sent: answering as `legacy-610` would otherwise find no person and render the
    // page with a blank name.
    db.select({
      id: schema.persons.id, firstName: schema.persons.firstName, lastName: schema.persons.lastName,
    }).from(schema.persons).where(eq(schema.persons.id, invitee.personId ?? personId)).limit(1),
  ])
  if (!ev) throw createError({ statusCode: 404, message: 'Event not found' })

  // WHAT IT COSTS. Event-level lines only (session_id IS NULL) — a per-session price
  // depends on which sessions they pick, which is a registration form's job, not a
  // yes/no. Accepting a charged event raises the invoice, so the price has to be on
  // screen BEFORE the button, not discovered afterwards.
  const feeRows = await db.select({ name: schema.feeComponents.name, amount: schema.feeComponents.amount })
    .from(schema.feeComponents)
    .where(and(eq(schema.feeComponents.eventId, ev.id), isNull(schema.feeComponents.sessionId)))
  const fees = feeRows.map(f => ({ name: f.name, amount: Number(f.amount) || 0 }))
  const feeTotal = fees.reduce((n, f) => n + f.amount, 0)

  if (response) {
    // A cancelled event can't be RSVP'd to — but we still let the page LOAD above,
    // so the invitee sees "this event was cancelled" rather than a dead link.
    if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') {
      throw createError({ statusCode: 409, message: 'This event has been cancelled.' })
    }
    const status = response === 'yes' ? 'CONFIRMED' : 'DECLINED'
    await db.update(schema.invitees)
      .set({ status, respondedAt: new Date() })
      .where(eq(schema.invitees.id, invitee.id))
    invitee.status = status

    // ACCEPTING RAISES THE INVOICE — the club's own books, in their system, every
    // time. Only on yes: being invited, or declining, owes nothing.
    //
    // After the RSVP is stored and never allowed to fail it: a member who says yes
    // has said yes even if the club's system is unreachable, and an uncharged
    // acceptance is recoverable by hand. Their endpoint refuses to charge the same
    // person twice, so changing the answer and changing it back is harmless.
    // Charge against the id the invitee row holds, so the person resolves the same
    // way whichever side answered.
    if (status === 'CONFIRMED') await onAttendeeConfirmed(ev.id, invitee.personId ?? personId)
  }

  return {
    event: {
      id: ev.id, title: ev.title,
      start_at: ev.startAt ? new Date(ev.startAt).toISOString() : null,
      end_at: ev.endAt ? new Date(ev.endAt).toISOString() : null,
      status: ev.status, locations: ev.locations, address: ev.address,
      description: ev.description ?? null,
      banner_url: ev.bannerUrl ?? null,
      fees,
      fee_total: feeTotal,
      // A form on the event means yes/no isn't the whole story — the page points
      // them at it once they've said yes.
      form_id: ev.formId ?? null,
    },
    person: person ? { first_name: person.firstName, last_name: person.lastName } : null,
    status: invitee.status,
    responded: !!response || !!invitee.respondedAt,
  }
})
