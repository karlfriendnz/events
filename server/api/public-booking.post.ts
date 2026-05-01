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
    .select('id, org_id, is_public, status, parent_id')
    .eq('id', bookableId)
    .eq('is_public', true)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (bErr || !bookable) {
    throw createError({ statusCode: 404, message: 'Bookable not found or not public' })
  }

  // Mode lookup — gives us approval_mode (used for status) and
  // configuration_key (used to expand a single picked sub-venue into the
  // full atomic slot, matching what the staff scheduler does).
  let bookingStatus: 'CONFIRMED' | 'PENDING' = 'PENDING'
  let modeConfigKey: string | null = null
  if (activityModeId) {
    const { data: mode } = await supabase
      .from('activity_modes')
      .select('approval_mode, configuration_key')
      .eq('id', activityModeId)
      .maybeSingle()
    if (mode?.approval_mode === 'INSTANT') bookingStatus = 'CONFIRMED'
    modeConfigKey = (mode?.configuration_key as string | null) ?? null
  }

  // Resolve the slot members the booking actually occupies. When the mode
  // requires a configuration we look up the slot in
  // bookable_configuration_children that contains this child, and use
  // every member of that slot. Otherwise the booking is single-row.
  let memberIds: string[] = [bookableId as string]
  if (modeConfigKey && bookable.parent_id) {
    const { data: cfg } = await supabase
      .from('bookable_configurations')
      .select('id')
      .eq('parent_bookable_id', bookable.parent_id)
      .eq('key', modeConfigKey)
      .maybeSingle()
    if (cfg?.id) {
      // Find the slot index this picked child belongs to, then pull every
      // member sharing that slot_index.
      const { data: pickedRow } = await supabase
        .from('bookable_configuration_children')
        .select('slot_index')
        .eq('configuration_id', cfg.id)
        .eq('bookable_id', bookableId)
        .maybeSingle()
      if (pickedRow?.slot_index !== undefined && pickedRow?.slot_index !== null) {
        const { data: slotMembers } = await supabase
          .from('bookable_configuration_children')
          .select('bookable_id')
          .eq('configuration_id', cfg.id)
          .eq('slot_index', pickedRow.slot_index)
          .order('sort_order')
        const ids = (slotMembers ?? []).map((r: any) => r.bookable_id as string)
        if (ids.length) memberIds = ids
      }
    }
  }

  // Pre-flight conflict check across every member sub-venue. Without this,
  // booking "Half A" when Q2 is already taken would silently overwrite —
  // the calendar can't currently cross-block slot peers visually.
  const { data: clashes } = await supabase
    .from('bookings')
    .select('id, bookable_id')
    .in('bookable_id', memberIds)
    .lt('start_at', endAt)
    .gt('end_at', startAt)
    .neq('status', 'CANCELLED')
  if (clashes && clashes.length) {
    throw createError({ statusCode: 409, message: 'Slot is no longer available — please pick a different time.' })
  }

  // Insert primary first, then children (each linked back via
  // parent_booking_id). The contact + addon payload is identical across
  // all rows so the staff calendar shows one logical booking per slot.
  const baseRow = {
    activity_id: activityId || null,
    activity_mode_id: activityModeId || null,
    type: 'ONE_OFF' as const,
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
  }

  const { data: bookingRow, error } = await supabase.from('bookings').insert({
    ...baseRow,
    bookable_id: memberIds[0],
  }).select('id').single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  if (memberIds.length > 1 && bookingRow?.id) {
    const childRows = memberIds.slice(1).map(bid => ({
      ...baseRow,
      bookable_id: bid,
      parent_booking_id: bookingRow.id,
    }))
    const { error: cErr } = await supabase.from('bookings').insert(childRows)
    if (cErr) {
      // Roll back the primary so we don't leave a half-written slot booking.
      await supabase.from('bookings').delete().eq('id', bookingRow.id)
      throw createError({ statusCode: 500, message: cErr.message })
    }
  }

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
