/**
 * Public booking lookup by short reference (first 8 chars of the UUID with
 * hyphens stripped, uppercased — e.g. "DD107C1C"). Returns a sanitised view
 * suitable for the customer-facing /booking/:ref page.
 *
 * Doesn't require auth — only the reference. Brute-forcing 8 hex chars is
 * 4 billion+ combinations, fine for prototype access.
 */
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const ref = String(body?.reference ?? '').trim().toLowerCase().replace(/-/g, '')
  if (!/^[0-9a-f]{6,32}$/.test(ref)) {
    throw createError({ statusCode: 400, message: 'Invalid reference' })
  }
  const supabase = createClient(supabaseUrl()!, serviceKey()!)

  // PostgREST doesn't reliably support LIKE on uuid columns, so we use a
  // UUID range scan: any uuid whose first 8 hex chars equal `prefix` falls
  // between `prefix-0000-0000-0000-000000000000` and `prefix-ffff-ffff-ffff-ffffffffffff`.
  const prefix = ref.slice(0, 8)
  const lo = `${prefix}-0000-0000-0000-000000000000`
  const hi = `${prefix}-ffff-ffff-ffff-ffffffffffff`
  const { data: rows } = await supabase
    .from('bookings')
    .select(`
      id, status, start_at, end_at, contact_name, contact_email, attendee_count, notes,
      bookable:bookables(id, name, location, org_id),
      activity:activities(name),
      activity_mode:activity_modes(id, name, color)
    `)
    .gte('id', lo)
    .lte('id', hi)
    .limit(10)
  const match = (rows ?? []).find((b: any) => b.id.replace(/-/g, '').toLowerCase().startsWith(ref))
  if (!match) throw createError({ statusCode: 404, message: 'Booking not found' })

  // Org name for branding.
  let orgName: string | null = null
  if (match.bookable?.org_id) {
    const { data: org } = await supabase.from('organisations').select('name').eq('id', match.bookable.org_id).maybeSingle<any>()
    orgName = org?.name ?? null
  }

  return {
    reference: match.id.replace(/-/g, '').slice(0, 8).toUpperCase(),
    status: match.status,
    start_at: match.start_at,
    end_at: match.end_at,
    contact_name: match.contact_name,
    contact_email_masked: match.contact_email
      ? match.contact_email.replace(/^(.).+(@.+)$/, '$1***$2')
      : null,
    attendee_count: match.attendee_count,
    notes: match.notes,
    venue: match.bookable ? { name: match.bookable.name, location: match.bookable.location } : null,
    activity: match.activity ? { name: match.activity.name } : null,
    activity_mode: match.activity_mode ? { name: match.activity_mode.name, color: match.activity_mode.color } : null,
    org_name: orgName,
  }
})
