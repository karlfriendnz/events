// GET /api/v1/dev/blocks?orgId= — the modular seed blocks that apply to ONE org,
// filtered by its kind (club vs governing body). DEV-GATED like the other dev tools.
import { seedBlockListSchema } from '../../../../shared/contracts/devSeed'
import { blocksForKind, type OrgKind } from '../../../db/seed/blocks'
import { getOrganisation } from '../../../db/repositories/organisations'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_SEED !== '1') {
    throw createError({ statusCode: 403, statusMessage: 'dev seeding disabled in production' })
  }
  const orgId = String(getQuery(event).orgId ?? '')
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  const org = await getOrganisation(orgId)
  if (!org) throw createError({ statusCode: 404, statusMessage: 'organisation not found' })
  // CLUB + RST behave like a club (people/classes/events/venues); everything else
  // (REGIONAL/ASSOCIATION/NATIONAL) is a governing body (disciplines).
  const kind: OrgKind = org.orgLevel === 'CLUB' || org.orgLevel === 'RST' ? 'club' : 'governing'
  const out = blocksForKind(kind).map(b => ({ key: b.key, label: b.label, description: b.description, options: b.options ?? [] }))
  return seedBlockListSchema.parse(out)
})
