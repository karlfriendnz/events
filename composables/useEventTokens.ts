/**
 * Merge fields for event messages — the event/person twin of useBookingTokens.
 *
 * PURE on purpose (no useDb/useOrg/Nuxt runtime), so the SERVER imports this
 * exact file to substitute at send time while the client imports it to offer the
 * insertable chips. One definition of what {first_name} means, not two.
 *
 * When the FriendlyManager mailer takes over templating, this is the map you
 * hand it — the token names are the contract, the rendering is not.
 */

export interface EventTokenContext {
  firstName?: string | null
  lastName?: string | null
  eventTitle?: string | null
  startAt?: Date | string | null
  endAt?: Date | string | null
  venueName?: string | null
  clubName?: string | null
}

export const EVENT_TOKENS = [
  { label: 'First name', value: '{first_name}', hint: "The recipient's first name" },
  { label: 'Last name',  value: '{last_name}',  hint: "The recipient's last name" },
  { label: 'Event',      value: '{event}',      hint: 'The event title' },
  { label: 'Date',       value: '{date}',       hint: 'When it runs' },
  { label: 'Time',       value: '{time}',       hint: 'Start time' },
  { label: 'Venue',      value: '{venue}',      hint: 'Where it is' },
  { label: 'Club',       value: '{club}',       hint: "Your club's name" },
]

function asDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  const v = d instanceof Date ? d : new Date(d)
  return Number.isNaN(v.getTime()) ? null : v
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/^0/, '').toLowerCase()
}

export function substituteEventTokens(template: string, ctx: EventTokenContext): string {
  if (!template) return template
  const start = asDate(ctx.startAt)
  const map: Record<string, string> = {
    '{first_name}': ctx.firstName ?? '',
    '{last_name}':  ctx.lastName ?? '',
    '{event}':      ctx.eventTitle ?? '',
    '{date}':       start ? fmtDate(start) : '',
    '{time}':       start ? fmtTime(start) : '',
    '{venue}':      ctx.venueName ?? '',
    '{club}':       ctx.clubName ?? '',
  }
  // Replace the longest tokens first so {first_name} can never be clipped by a
  // shorter overlapping token.
  return Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .reduce((out, token) => out.split(token).join(map[token]), template)
}

/**
 * The out-of-the-box invitation. A club that writes nothing still sends a decent
 * email — this is the "starting point" every event is seeded from, and it's what
 * the club edits in Settings to make it theirs.
 */
export const DEFAULT_INVITATION = {
  subject: "You're invited: {event}",
  body: "Hi {first_name},\n\nYou're invited to {event} on {date} at {venue}.\n\nLet us know if you can make it.\n\nThanks,\n{club}",
}
