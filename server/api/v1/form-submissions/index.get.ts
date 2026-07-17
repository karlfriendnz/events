// GET /api/v1/form-submissions?orgId=&formId=&limit=&offset= — the uniform record of
// every registration submission for an org, newest first, optionally narrowed to one
// form and/or paged. Output validated against the shared contract before it leaves.
import { listSubmissions } from '../../../db/repositories/forms'
import { formSubmissionListSchema } from '../../../../shared/contracts/form'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  const formId = typeof q.formId === 'string' && q.formId ? q.formId : undefined
  const limit = q.limit !== undefined ? Number(q.limit) : undefined
  const offset = q.offset !== undefined ? Number(q.offset) : undefined

  const submissions = await listSubmissions(orgId, {
    formId,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  })
  return formSubmissionListSchema.parse(submissions)
})
