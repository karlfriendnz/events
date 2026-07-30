// GET /api/v1/events/by-legacy-id?legacyId=134 — the module event mirrored onto that
// id on the old platform, or { id: null } when the event really is theirs.
//
// The club's calendar links to ITS copy, so following that link hands us a legacy id
// for an event this module owns. Callers use this to route to the real record instead
// of the read-only legacy view.
import { eventIdByLegacyId } from '../../../db/repositories/events'

export default defineEventHandler(async (event) => {
  const raw = String(getQuery(event).legacyId ?? '')
  const legacyId = Number(raw.replace(/^legacy-/i, ''))
  if (!raw || !Number.isFinite(legacyId)) {
    throw createError({ statusCode: 400, statusMessage: 'legacyId is required' })
  }
  return { id: await eventIdByLegacyId(legacyId) }
})
