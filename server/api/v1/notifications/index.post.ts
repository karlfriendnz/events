// POST /api/v1/notifications — insert a staff notification row (booking approved/
// declined, etc.) and return its id. The page fires the email trigger separately
// (`/api/send-notification-email`), which stays outside the seam (a legacy endpoint).
import { createNotification } from '../../../db/repositories/communications'
import { notificationCreateSchema } from '../../../../shared/contracts/communication'

export default defineEventHandler(async (event) => {
  const input = notificationCreateSchema.parse(await readBody(event))
  return await createNotification(input)
})
