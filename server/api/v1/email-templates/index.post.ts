// POST /api/v1/email-templates — upsert the club's wording for one email kind
// (unique by org + key). Validates in against the upsert contract, returns the saved
// template validated against the read contract.
import { upsertEmailTemplate } from '../../../db/repositories/communications'
import { emailTemplateUpsertSchema, emailTemplateSchema } from '../../../../shared/contracts/communication'

export default defineEventHandler(async (event) => {
  const input = emailTemplateUpsertSchema.parse(await readBody(event))
  return emailTemplateSchema.parse(
    await upsertEmailTemplate(input.orgId, input.key, input.subject, input.body),
  )
})
