// GET /api/v1/public/events?org=<id>[&venues=&categories=&types=] — the PUBLISHED,
// public, dated events for the embed calendar. The published/public/dated gate is
// hardcoded in the repo, NEVER taken from the query; venues/categories/types are only
// optional NARROWING (CSV) and are applied server-side so the internal fields they key
// off never leave the seam.
import { publicEvents } from '../../../db/repositories/public'
import { publicEventListSchema } from '../../../../shared/contracts/public'

const csv = (v: unknown): string[] => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const org = String(query.org ?? '')
  if (!org) throw createError({ statusCode: 400, statusMessage: 'org is required' })
  const rows = await publicEvents(org, {
    venues: csv(query.venues),
    categories: csv(query.categories),
    types: csv(query.types),
  })
  return publicEventListSchema.parse(rows)
})
