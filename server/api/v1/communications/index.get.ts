// GET /api/v1/communications?orgId= — an org's sent communications. `?resource=`
// switches to the sibling comms catalogues that share this org scope: `topics` (the
// comms categories a person can subscribe to) and `templates` (the club's email
// templates). The client only ever talks to routes like this, never to the
// database. Output is validated against the shared contract before it leaves.
import {
  listCommunications,
  listCommunicationTopics,
  listActiveCommunicationTopics,
  listEmailTemplates,
} from '../../../db/repositories/waitlists'
import {
  communicationListSchema,
  communicationTopicListSchema,
  emailTemplateListSchema,
} from '../../../../shared/contracts/waitlist'

export default defineEventHandler(async (event) => {
  const { orgId, resource } = getQuery(event)
  if (!orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const id = String(orgId)
  if (resource === 'topics') {
    return communicationTopicListSchema.parse(await listCommunicationTopics(id))
  }
  if (resource === 'active-topics') {
    return communicationTopicListSchema.parse(await listActiveCommunicationTopics(id))
  }
  if (resource === 'templates') {
    return emailTemplateListSchema.parse(await listEmailTemplates(id))
  }
  return communicationListSchema.parse(await listCommunications(id))
})
