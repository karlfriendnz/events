// Public self-check-in at an event (the per-event QR the attendee scans at the door).
//
// Two shapes, mirroring public-rsvp:
//  • POST { eventId }            → { event, invitees:[{personId,name}] } so the page
//    can render the event and let the visitor find themselves in the list.
//  • POST { eventId, personId }  → { ok:true }, marking invitees.attended=true.
//
// The (event, person) pair IS the credential — you can only check in against an
// invitee row that already exists, so nobody can check into an event they weren't
// invited to. Idempotent. Reads/writes the MySQL seam (where the live invitees are).
import { and, eq } from 'drizzle-orm'
import { db, schema } from '../db/client'
import { getEvent, inviteesForEvent } from '../db/repositories/events'

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as { eventId?: string; personId?: string }
  if (!body?.eventId) throw createError({ statusCode: 400, statusMessage: 'eventId required' })

  const ev = await getEvent(body.eventId)
  if (!ev) throw createError({ statusCode: 404, statusMessage: 'Event not found' })

  const evOut = {
    id: ev.id,
    title: ev.title,
    start_at: ev.startAt ?? null,
    end_at: ev.endAt ?? null,
    status: ev.status,
    locations: ev.locations ?? null,
    address: ev.address ?? null,
  }

  // No personId → hand back the invitee list so the visitor can pick themselves.
  if (!body.personId) {
    const invs = await inviteesForEvent(body.eventId)
    const invitees = invs
      .filter((i: any) => i.personId)
      .map((i: any) => ({
        personId: i.personId,
        name: [i.person?.firstName, i.person?.lastName].filter(Boolean).join(' ').trim() || 'Guest',
      }))
    return { event: evOut, invitees }
  }

  // With personId → check in. A cancelled/archived event can't be checked into.
  if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') {
    throw createError({ statusCode: 409, statusMessage: 'This event has been cancelled.' })
  }
  const [inv] = await db
    .select({ id: schema.invitees.id })
    .from(schema.invitees)
    .where(and(eq(schema.invitees.eventId, body.eventId), eq(schema.invitees.personId, body.personId)))
    .limit(1)
  if (!inv) throw createError({ statusCode: 404, statusMessage: "We couldn't find your invitation." })
  await db.update(schema.invitees).set({ attended: true }).where(eq(schema.invitees.id, inv.id))
  return { ok: true }
})
