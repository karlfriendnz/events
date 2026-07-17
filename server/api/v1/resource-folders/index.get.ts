// GET /api/v1/resource-folders?orgId=… — the folders of one org's resource
// library. The client only ever talks to routes like this, never to the database.
// Output is validated against the shared contract before it leaves, so the client's
// types are guaranteed.
import { listFolders } from '../../../db/repositories/resources'
import { resourceFolderListSchema } from '../../../../shared/contracts/resource'

export default defineEventHandler(async (event) => {
  const orgId = getQuery(event).orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const folders = await listFolders(orgId)
  // Parse-on-output: the route can never accidentally ship a shape the client
  // didn't agree to. Throws (500) if the repo drifts from the contract.
  return resourceFolderListSchema.parse(folders)
})
