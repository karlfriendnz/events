import { createClient } from '@supabase/supabase-js'

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

  const supabase = createClient(supabaseUrl()!, serviceKey()!)

  // The invitation must already exist — this endpoint answers an invite, it never
  // creates one. A missing row means the link is bogus or the invite was pulled.
  const { data: invitee } = await supabase.from('invitees')
    .select('id, status, responded_at')
    .eq('event_id', eventId).eq('person_id', personId).maybeSingle()
  if (!invitee) throw createError({ statusCode: 404, message: 'This invitation is no longer valid.' })

  // NB `locations` (jsonb array, migration 004) — there is no `location` column.
  const [{ data: ev }, { data: person }] = await Promise.all([
    supabase.from('events')
      .select('id, title, start_at, end_at, status, locations, address, form_id').eq('id', eventId).maybeSingle(),
    supabase.from('persons').select('id, first_name, last_name').eq('id', personId).maybeSingle(),
  ])
  if (!ev) throw createError({ statusCode: 404, message: 'Event not found' })

  if (response) {
    // A cancelled event can't be RSVP'd to — but we still let the page LOAD above,
    // so the invitee sees "this event was cancelled" rather than a dead link.
    if (ev.status === 'CANCELLED' || ev.status === 'ARCHIVED') {
      throw createError({ statusCode: 409, message: 'This event has been cancelled.' })
    }
    const status = response === 'yes' ? 'CONFIRMED' : 'DECLINED'
    const { error } = await supabase.from('invitees')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', invitee.id)
    if (error) throw createError({ statusCode: 500, message: error.message })
    invitee.status = status
  }

  return {
    event: {
      id: ev.id, title: ev.title, start_at: ev.start_at, end_at: ev.end_at,
      status: ev.status, locations: ev.locations, address: ev.address,
      // A form on the event means yes/no isn't the whole story — the page points
      // them at it once they've said yes.
      form_id: ev.form_id ?? null,
    },
    person: person ? { first_name: person.first_name, last_name: person.last_name } : null,
    status: invitee.status,
    responded: !!response || !!invitee.responded_at,
  }
})
