/**
 * Generate the access code + materialise physical_schedules rows for a
 * confirmed booking on an access-controlled venue.
 *
 * Idempotent: if bookings.access_code is already set we no-op. Safe to
 * call from public + staff booking paths after the booking row exists.
 *
 * Body: { bookingId: string }
 */
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { bookingId } = body as { bookingId?: string }
  if (!bookingId) throw createError({ statusCode: 400, message: 'bookingId required' })

  const supabase = createClient(supabaseUrl()!, serviceKey()!)

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .select(`
      id, bookable_id, start_at, end_at, status, access_code, parent_booking_id,
      bookable:bookables(
        id, name, org_id,
        access_enabled, access_code_delivery, access_code_length,
        access_unlock_before_mins, access_unlock_after_mins,
        lighting_ramp_up_mins, lighting_ramp_down_mins, lighting_level_percent
      )
    `)
    .eq('id', bookingId)
    .maybeSingle<any>()

  if (bErr || !booking) throw createError({ statusCode: 404, message: 'booking not found' })

  // Children of a multi-bookable slot booking inherit from the primary —
  // skip them so we don't double-generate codes for the same logical booking.
  if (booking.parent_booking_id) return { skipped: 'child-of-slot' }

  const venue = booking.bookable
  if (!venue?.access_enabled) return { skipped: 'access-not-enabled' }
  if (booking.access_code) return { skipped: 'already-finalised', code: booking.access_code }
  if (booking.status === 'CANCELLED') return { skipped: 'cancelled' }

  // 1. Generate a random N-digit numeric code, padded.
  const length = Math.max(4, Math.min(12, venue.access_code_length ?? 6))
  const max = 10 ** length
  const code = String(Math.floor(Math.random() * max)).padStart(length, '0')

  // 2. Stamp it on the booking now so re-entry is a no-op.
  const { error: upErr } = await supabase
    .from('bookings')
    .update({ access_code: code })
    .eq('id', bookingId)
  if (upErr) throw createError({ statusCode: 500, message: upErr.message })

  // 3. Materialise physical_schedules: one row per connected door, one per zone.
  const start = new Date(booking.start_at)
  const end   = new Date(booking.end_at)

  const unlockOn  = new Date(start.getTime() - (venue.access_unlock_before_mins ?? 5) * 60000)
  const unlockOff = new Date(end.getTime()   + (venue.access_unlock_after_mins  ?? 5) * 60000)
  const lightOn   = new Date(start.getTime() - (venue.lighting_ramp_up_mins   ?? 0) * 60000)
  const lightOff  = new Date(end.getTime()   + (venue.lighting_ramp_down_mins ?? 0) * 60000)

  const [{ data: doorLinks }, { data: zoneLinks }] = await Promise.all([
    supabase.from('bookable_doors').select('door_id').eq('bookable_id', venue.id),
    supabase.from('bookable_light_zones').select('zone_id').eq('bookable_id', venue.id),
  ])

  const scheduleRows: any[] = []
  for (const link of doorLinks ?? []) {
    scheduleRows.push({
      booking_id: bookingId,
      bookable_id: venue.id,
      door_id: link.door_id,
      scheduled_on_at: unlockOn.toISOString(),
      scheduled_off_at: unlockOff.toISOString(),
    })
  }
  for (const link of zoneLinks ?? []) {
    scheduleRows.push({
      booking_id: bookingId,
      bookable_id: venue.id,
      light_zone_id: link.zone_id,
      scheduled_on_at: lightOn.toISOString(),
      scheduled_off_at: lightOff.toISOString(),
      level_percent: venue.lighting_level_percent ?? 100,
    })
  }
  if (scheduleRows.length) {
    const { error: psErr } = await supabase.from('physical_schedules').insert(scheduleRows)
    if (psErr) {
      // Don't roll back the code — schedule rows can be regenerated; losing the
      // code mid-flight would break delivery. Surface as a warning instead.
      // eslint-disable-next-line no-console
      console.error('[finalize-access] physical_schedules insert failed', psErr)
    }
  }

  // 4. Deliver the code if requested. Email path only for now; SMS is a stub.
  const delivery = (venue.access_code_delivery ?? 'none') as 'none' | 'email' | 'sms' | 'both'
  let deliveredAt: string | null = null
  if (delivery === 'email' || delivery === 'both') {
    try {
      await $fetch('/api/send-access-code-email', {
        method: 'POST',
        body: { bookingId },
      })
      deliveredAt = new Date().toISOString()
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[finalize-access] email send failed', err)
    }
  }
  if (deliveredAt) {
    await supabase.from('bookings').update({ access_code_delivered_at: deliveredAt }).eq('id', bookingId)
  }

  return {
    code,
    schedulesCreated: scheduleRows.length,
    delivery,
    deliveredAt,
  }
})
