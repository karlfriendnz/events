// GET /api/v1/events/invitees-by-person?personId= — every invitee row for one
// person across all events, enriched with each event's title/start/status. Feeds the
// profile activity feed. Output validated against the shared contract. (gap D9)
import { inviteesForPerson, legacyIdsForEventIds } from '../../../db/repositories/events'
import { inviteeForPersonListSchema } from '../../../../shared/contracts/event'
import { isLegacyPersonId, legacyInviteesForPerson } from '../../../utils/legacyBridge'

export default defineEventHandler(async (event) => {
  const { personId } = getQuery(event)
  if (!personId || typeof personId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'personId required' })
  }
  const rows = await inviteesForPerson(personId)
  // A person from the OLD platform: fold in what IT knows they're on. Both sources,
  // because a bridged member can be on our events AND theirs — showing only one half
  // on a tab titled "Events" is worse than showing none.
  if (isLegacyPersonId(personId)) {
    const seen = new Set(rows.map((r: any) => r.eventId))
    // Our events are MIRRORED onto their calendar, so their list includes copies of
    // events already above — under a different id, which `seen` alone cannot match.
    // Skip any legacy row that is one of ours wearing its mirror's id, or the tab
    // lists every bridged event twice.
    const mirrored = await legacyIdsForEventIds([...seen] as string[])
    for (const r of await legacyInviteesForPerson(personId)) {
      const legacyNum = Number(String(r.eventId).replace(/^legacy-/i, ''))
      if (mirrored.has(legacyNum)) continue
      if (!seen.has(r.eventId)) rows.push(r as any)
    }
  }
  return inviteeForPersonListSchema.parse(rows)
})
