// POST /api/v1/calendar-org-invitees — share a whole calendar with an affiliated club.
// Best-effort email to the club's contact (branded as the sharing org); the club also
// sees it on its dashboard regardless (EventInviteInbox).
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { createCalendarOrgInvitee } from '../../../db/repositories/events'
import { calendarOrgInviteeSchema } from '../../../../shared/contracts/event'
import { renderBrandedEmail, sendEmail } from '../../../utils/email'

const bodySchema = z.object({
  calendarId: z.string(),
  orgId: z.string(),
  invitedByOrgId: z.string().nullable().optional(),
  status: z.string().optional(),
})

// Fire the share email — never throws (a failed email must not fail the share).
async function emailClub(event: any, invite: { calendarId: string; orgId: string; invitedByOrgId?: string | null }) {
  try {
    const [club] = await db.select({ email: schema.organisations.email, name: schema.organisations.name })
      .from(schema.organisations).where(eq(schema.organisations.id, invite.orgId)).limit(1)
    if (!club?.email) return   // no contact address — the dashboard still covers it
    const [body] = invite.invitedByOrgId
      ? await db.select({ name: schema.organisations.name, brandColor: schema.organisations.brandColor, brandTextColor: schema.organisations.brandTextColor, logoUrl: schema.organisations.logoUrl })
          .from(schema.organisations).where(eq(schema.organisations.id, invite.invitedByOrgId)).limit(1)
      : [null as any]
    const [cal] = await db.select({ name: schema.calendars.name })
      .from(schema.calendars).where(eq(schema.calendars.id, invite.calendarId)).limit(1)

    const bodyName = body?.name || 'A governing body'
    const origin = getRequestURL(event).origin
    const html = renderBrandedEmail({
      brand: { name: bodyName, brand_color: body?.brandColor ?? null, brand_text_color: body?.brandTextColor ?? null, logo_url: body?.logoUrl ?? null },
      bodyHtml: `<p style="margin:0 0 12px"><strong>${bodyName}</strong> has shared a calendar with <strong>${club.name}</strong>.</p>
                 <p style="margin:0 0 4px">Accept it from your dashboard and its events appear on your own calendar.</p>`,
      card: { title: cal?.name || 'Shared calendar', lines: [] },
      actions: [{ label: 'Open your dashboard', url: `${origin}/dashboard` }],
      footnote: 'You can accept or decline this shared calendar from your FriendlyManager dashboard.',
    })
    await sendEmail({ to: club.email, subject: `${bodyName} shared a calendar with you`, html })
  } catch (e) {
    console.error('[calendar-share email]', (e as any)?.message ?? e)
  }
}

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))
  const created = await createCalendarOrgInvitee(body)
  // Only email on a genuinely new share (createCalendarOrgInvitee is idempotent).
  if (created.status === 'INVITED') await emailClub(event, body)
  return calendarOrgInviteeSchema.parse(created)
})
