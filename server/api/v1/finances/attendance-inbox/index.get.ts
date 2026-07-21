// GET /api/v1/finances/attendance-inbox?orgId=&from=&to=&groupIds=&eventIds=
// Per-user "rolls to complete": occurrences in [from, to) for the caller's own
// group ids (training) and/or event ids (standalone), each with a derived
// markedCount. groupIds/eventIds are comma-separated; with neither, returns [].
import { attendanceInbox } from '../../../../db/repositories/finances'
import { attendanceInboxListSchema } from '../../../../../shared/contracts/finance'

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const orgId = q.orgId
  const from = q.from
  const to = q.to
  if (typeof orgId !== 'string' || !orgId) {
    throw createError({ statusCode: 400, statusMessage: 'orgId is required' })
  }
  if (typeof from !== 'string' || typeof to !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'from and to are required' })
  }
  const parseIds = (v: unknown) => (typeof v === 'string' && v ? v.split(',').filter(Boolean) : [])
  const groupIds = parseIds(q.groupIds)
  const eventIds = parseIds(q.eventIds)
  return attendanceInboxListSchema.parse(await attendanceInbox(orgId, groupIds, eventIds, from, to))
})
