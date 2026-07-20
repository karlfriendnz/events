// POST /api/v1/event-org-invitees — invite a whole affiliated club to an event.
// Also fires a best-effort email to the club's contact address (branded as the
// inviting body). The club sees it on its dashboard regardless (EventInviteInbox).
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db, schema } from '../../../db/client'
import { createEventOrgInvitee } from '../../../db/repositories/events'
import { eventOrgInviteeSchema } from '../../../../shared/contracts/event'
import { renderBrandedEmail, sendEmail } from '../../../utils/email'

const bodySchema = z.object({
  eventId: z.string(),
  orgId: z.string(),
  invitedByOrgId: z.string().nullable().optional(),
  status: z.string().optional(),
  disciplineId: z.string().nullable().optional(),
})

// Fire the invitation email — never throws (a failed email must not fail the invite).
async function emailClub(event: any, invite: { eventId: string; orgId: string; invitedByOrgId?: string | null }) {
  try {
    const [club] = await db.select({ email: schema.organisations.email, name: schema.organisations.name })
      .from(schema.organisations).where(eq(schema.organisations.id, invite.orgId)).limit(1)
    if (!club?.email) return   // no contact address — dashboard still covers it
    const [body] = invite.invitedByOrgId
      ? await db.select({ name: schema.organisations.name, brandColor: schema.organisations.brandColor, brandTextColor: schema.organisations.brandTextColor, logoUrl: schema.organisations.logoUrl })
          .from(schema.organisations).where(eq(schema.organisations.id, invite.invitedByOrgId)).limit(1)
      : [null as any]
    const [ev] = await db.select({ title: schema.events.title, startAt: schema.events.startAt, address: schema.events.address })
      .from(schema.events).where(eq(schema.events.id, invite.eventId)).limit(1)

    const bodyName = body?.name || 'A governing body'
    const origin = getRequestURL(event).origin
    const when = ev?.startAt ? new Date(ev.startAt).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''
    const html = renderBrandedEmail({
      brand: { name: bodyName, brand_color: body?.brandColor ?? null, brand_text_color: body?.brandTextColor ?? null, logo_url: body?.logoUrl ?? null },
      bodyHtml: `<p style="margin:0 0 12px"><strong>${bodyName}</strong> has invited <strong>${club.name}</strong> to an event.</p>
                 <p style="margin:0 0 4px">Accept it from your dashboard to choose what you connect (event details, fees, communication).</p>`,
      card: { title: ev?.title || 'Event', lines: [when, ev?.address || ''] },
      actions: [{ label: 'Open your dashboard', url: `${origin}/dashboard` }],
      footnote: 'You can accept or decline this invitation from your FriendlyManager dashboard.',
    })
    await sendEmail({ to: club.email, subject: `${bodyName} invited you to ${ev?.title || 'an event'}`, html })
  } catch (e) {
    console.error('[event-club-invite email]', (e as any)?.message ?? e)
  }
}

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event))
  const created = await createEventOrgInvitee(body)
  // Only email on a genuinely new invite (createEventOrgInvitee is idempotent).
  if (created.status === 'INVITED') await emailClub(event, body)
  return eventOrgInviteeSchema.parse(created)
})
