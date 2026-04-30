import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { bookableId, activityId, activityModeId, startAt, endAt, contactName, contactEmail, contactPhone, notes, selectedAddons, attendeeCount, bookingDiscountId, discountAmount, customFields } = body

  if (!bookableId || !startAt || !endAt || !contactName || !contactEmail) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )

  const { data: bookable, error: bErr } = await supabase
    .from('bookables')
    .select('id, org_id, is_public, status')
    .eq('id', bookableId)
    .eq('is_public', true)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (bErr || !bookable) {
    throw createError({ statusCode: 404, message: 'Bookable not found or not public' })
  }

  // Mode-level approval: INSTANT → CONFIRMED, otherwise the booking lands as PENDING.
  let bookingStatus: 'CONFIRMED' | 'PENDING' = 'PENDING'
  if (activityModeId) {
    const { data: mode } = await supabase
      .from('activity_modes')
      .select('approval_mode')
      .eq('id', activityModeId)
      .maybeSingle()
    if (mode?.approval_mode === 'INSTANT') bookingStatus = 'CONFIRMED'
  }

  const { data: bookingRow, error } = await supabase.from('bookings').insert({
    bookable_id: bookableId,
    activity_id: activityId || null,
    activity_mode_id: activityModeId || null,
    type: 'ONE_OFF',
    status: bookingStatus,
    start_at: startAt,
    end_at: endAt,
    notes: notes || null,
    selected_addons: selectedAddons ?? [],
    attendee_count: attendeeCount || null,
    contact_name: contactName,
    contact_email: contactEmail,
    contact_phone: contactPhone || null,
    is_all_day: false,
    booking_discount_id: bookingDiscountId || null,
    discount_amount: discountAmount ?? null,
    custom_fields: customFields ?? {},
  }).select('id').single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  // Drop a notification so staff see it in the bell menu.
  const isPending = bookingStatus === 'PENDING'
  const { data: notif } = await supabase.from('notifications').insert({
    org_id: bookable.org_id,
    type: isPending ? 'booking.pending' : 'booking.created',
    title: isPending ? 'New booking awaiting approval' : 'New booking',
    body: `${contactName} — ${new Date(startAt).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`,
    link: `/bookables/${bookableId}?tab=bookings`,
    payload: {
      contact_name: contactName,
      contact_email: contactEmail,
      start_at: startAt,
      end_at: endAt,
      bookable_id: bookableId,
      activity_id: activityId,
      activity_mode_id: activityModeId,
    },
  }).select('id').single()

  // Fire-and-forget the email dispatcher (currently a stub — see
  // server/api/send-notification-email.post.ts).
  if (notif?.id) {
    $fetch('/api/send-notification-email', {
      method: 'POST',
      body: { notificationId: notif.id },
    }).catch(() => { /* non-fatal */ })
  }
  // Customer-facing confirmation email.
  if (bookingRow?.id) {
    $fetch('/api/send-customer-booking-email', {
      method: 'POST',
      body: { bookingId: bookingRow.id, event: 'created' },
    }).catch(() => { /* non-fatal */ })
  }

  return {
    success: true,
    bookingId: bookingRow?.id ?? null,
    status: bookingStatus,
  }
})
