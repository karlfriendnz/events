// POST /api/v1/admin/set-org-template — mark/unmark an org as a reusable setup template.
import { z } from 'zod'
import { setOrgTemplate } from '../../../db/repositories/admin'

const bodySchema = z.object({ id: z.string().min(1), isTemplate: z.boolean() })

export default defineEventHandler(async (event) => {
  const { id, isTemplate } = bodySchema.parse(await readBody(event))
  await setOrgTemplate(id, isTemplate)
  return { ok: true }
})
