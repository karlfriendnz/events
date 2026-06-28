import { createClient } from '@supabase/supabase-js'

// Atomically claims a usage slot on a booking_discount.
// Uses a conditional UPDATE so two concurrent requests can't both take the last slot.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { discountId } = body as { discountId?: string }

  if (!discountId) {
    throw createError({ statusCode: 400, message: 'discountId required' })
  }

  const supabase = createClient(
    supabaseUrl()!,
    serviceKey()!,
  )

  // Grab current state.
  const { data: disc, error: readErr } = await supabase
    .from('booking_discounts')
    .select('id, is_active, max_uses, uses_count')
    .eq('id', discountId)
    .maybeSingle()

  if (readErr || !disc) throw createError({ statusCode: 404, message: 'Discount not found' })
  if (!disc.is_active) throw createError({ statusCode: 410, message: 'Discount is no longer active' })

  // Unlimited cap — just bump the counter for reporting.
  if (disc.max_uses == null) {
    const { error } = await supabase
      .from('booking_discounts')
      .update({ uses_count: disc.uses_count + 1 })
      .eq('id', discountId)
    if (error) throw createError({ statusCode: 500, message: error.message })
    return { claimed: true }
  }

  // Conditional increment — only succeeds while uses_count matches and is below cap.
  if (disc.uses_count >= disc.max_uses) {
    throw createError({ statusCode: 409, message: 'Discount usage cap reached' })
  }

  const { data: updated, error: updErr } = await supabase
    .from('booking_discounts')
    .update({ uses_count: disc.uses_count + 1 })
    .eq('id', discountId)
    .eq('uses_count', disc.uses_count)
    .lt('uses_count', disc.max_uses)
    .select('id, uses_count')
    .maybeSingle()

  if (updErr) throw createError({ statusCode: 500, message: updErr.message })
  if (!updated) throw createError({ statusCode: 409, message: 'Discount was claimed by another booking — please retry' })

  return { claimed: true, uses_count: updated.uses_count }
})
