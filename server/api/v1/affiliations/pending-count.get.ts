// GET /api/v1/affiliations/pending-count?orgId=… — how many affiliation requests are
// waiting anywhere in a body's subtree. Drives the nav badge.
import { z } from 'zod'
import { pendingCountForBody } from '../../../db/repositories/affiliations'

const outSchema = z.object({ count: z.number().int() })

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (!orgId || typeof orgId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const count = await pendingCountForBody(orgId)
  return outSchema.parse({ count })
})
