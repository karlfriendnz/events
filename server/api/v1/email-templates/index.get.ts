// GET /api/v1/email-templates?orgId=&key= — the club's saved wording for one email
// kind (e.g. 'event_invitation'), or null when never saved. The client only ever
// talks to routes like this, never to the database.
import { getEmailTemplate } from '../../../db/repositories/communications'
import { emailTemplateOrNullSchema } from '../../../../shared/contracts/communication'

export default defineEventHandler(async (event) => {
  const { orgId, key } = getQuery(event)
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  if (!key) throw createError({ statusCode: 400, statusMessage: 'key is required' })
  return emailTemplateOrNullSchema.parse(await getEmailTemplate(String(orgId), String(key)))
})
