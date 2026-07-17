// GET /api/v1/organisations — the public face of the seam. The client only ever
// talks to routes like this, never to the database. Output is validated against
// the shared contract before it leaves, so the client's types are guaranteed.
//
// /v1/ from the start: this is a versioned API the backend team will re-implement,
// so the contract has a stable name to honour.
import { listOrganisations } from '../../../db/repositories/organisations'
import { organisationListSchema } from '../../../../shared/contracts/organisation'

export default defineEventHandler(async () => {
  const orgs = await listOrganisations()
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return organisationListSchema.parse(orgs)
})
