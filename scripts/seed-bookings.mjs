import { createClient } from '@supabase/supabase-js'

const db = createClient(
  'https://hqhvuwfhnxrkeeoevvtx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaHZ1d2Zobnhya2Vlb2V2dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0ODU0OSwiZXhwIjoyMDkxNzI0NTQ5fQ.NKc_dawyUemyBWTJEPJtxM2F1KP8cn4yWtQR_lBE4-Q'
)

function dt(offsetDays, hour, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

async function run() {
  const { data: bookables } = await db.from('bookables').select('id, name').eq('org_id', '00000000-0000-0000-0000-000000000002')
  const b = Object.fromEntries(bookables.map(x => [x.name, x.id]))

  const { data: events } = await db.from('events').select('id, title').eq('org_id', '00000000-0000-0000-0000-000000000002').neq('status', 'ARCHIVED')
  const e = Object.fromEntries(events.map(x => [x.title, x.id]))
  console.log('Events:', Object.keys(e).join(', '))

  const base = { type: 'ONE_OFF' }
  const bookings = [
    // ── Today ──────────────────────────────────────────────────────
    // Tennis courts busy this morning
    { ...base, bookable_id: b['Court 1'], start_at: dt(0,7), end_at: dt(0,9), status: 'CONFIRMED', purpose: 'Senior squad warm-up' },
    { ...base, bookable_id: b['Court 2'], start_at: dt(0,7), end_at: dt(0,9), status: 'CONFIRMED', purpose: 'Senior squad warm-up' },
    { ...base, bookable_id: b['Court 3'], start_at: dt(0,8), end_at: dt(0,10), status: 'CONFIRMED', purpose: 'Junior coaching' },
    // Football fields - training session now
    { ...base, bookable_id: b['Field 1'], start_at: dt(0,9), end_at: dt(0,12), status: 'CONFIRMED', purpose: 'Senior training', event_id: e['Training Week'] ?? null },
    { ...base, bookable_id: b['Field 2'], start_at: dt(0,9), end_at: dt(0,11), status: 'CONFIRMED', purpose: 'Academy session' },
    // Swimming pool lanes booked this morning
    { ...base, bookable_id: b['Lane 1'], start_at: dt(0,6), end_at: dt(0,8), status: 'CONFIRMED', purpose: 'Masters squad' },
    { ...base, bookable_id: b['Lane 2'], start_at: dt(0,6), end_at: dt(0,8), status: 'CONFIRMED', purpose: 'Masters squad' },
    { ...base, bookable_id: b['Lane 3'], start_at: dt(0,6,30), end_at: dt(0,8,30), status: 'CONFIRMED', purpose: 'Learn-to-swim class' },
    // Projector booked for a meeting today
    { ...base, bookable_id: b['Projector & Screen'], start_at: dt(0,14), end_at: dt(0,16), status: 'CONFIRMED', purpose: 'Board presentation' },
    // PA System booked this afternoon
    { ...base, bookable_id: b['PA System'], start_at: dt(0,15), end_at: dt(0,18), status: 'CONFIRMED', purpose: 'Club announcements' },
    // Locker bookings (seasonal)
    { ...base, bookable_id: b['Locker 1'], start_at: dt(-90, 8), end_at: dt(90, 18), status: 'CONFIRMED', purpose: 'Season locker — M. Holloway' },
    { ...base, bookable_id: b['Locker 2'], start_at: dt(-90, 8), end_at: dt(90, 18), status: 'CONFIRMED', purpose: 'Season locker — D. Tran' },
    { ...base, bookable_id: b['Locker 3'], start_at: dt(-90, 8), end_at: dt(90, 18), status: 'CONFIRMED', purpose: 'Season locker — P. Sharma' },
    { ...base, bookable_id: b['Locker 4'], start_at: dt(-30, 8), end_at: dt(60, 18), status: 'CONFIRMED', purpose: 'Season locker — L. Reid' },

    // ── Tomorrow ───────────────────────────────────────────────────
    { ...base, bookable_id: b['Club Rooms'], start_at: dt(1,18), end_at: dt(1,20), status: 'CONFIRMED', purpose: 'Committee meeting prep', event_id: e['Committee Meeting'] ?? null },
    { ...base, bookable_id: b['Court 1'], start_at: dt(1,9), end_at: dt(1,12), status: 'CONFIRMED', purpose: 'Junior tournament' },
    { ...base, bookable_id: b['Court 2'], start_at: dt(1,9), end_at: dt(1,12), status: 'CONFIRMED', purpose: 'Junior tournament' },
    { ...base, bookable_id: b['Cricket Nets'], start_at: dt(1,15), end_at: dt(1,17), status: 'CONFIRMED', purpose: 'Batting practice' },
    { ...base, bookable_id: b['Net 1'], start_at: dt(1,15), end_at: dt(1,17), status: 'CONFIRMED', purpose: 'Batting practice' },
    { ...base, bookable_id: b['James Carter'], start_at: dt(1,9), end_at: dt(1,12), status: 'CONFIRMED', purpose: 'Junior coaching session' },

    // ── This weekend ───────────────────────────────────────────────
    { ...base, bookable_id: b['Football Fields'], start_at: dt(3,10), end_at: dt(3,16), status: 'CONFIRMED', purpose: 'Club competition day' },
    { ...base, bookable_id: b['Field 1'], start_at: dt(3,10), end_at: dt(3,16), status: 'CONFIRMED', purpose: 'Match 1' },
    { ...base, bookable_id: b['Field 2'], start_at: dt(3,12), end_at: dt(3,16), status: 'CONFIRMED', purpose: 'Match 2' },
    { ...base, bookable_id: b['Marquee'], start_at: dt(3,8), end_at: dt(3,18), status: 'CONFIRMED', purpose: 'Spectator area' },
    { ...base, bookable_id: b['PA System'], start_at: dt(3,9), end_at: dt(3,17), status: 'CONFIRMED', purpose: 'MC & announcements' },
    { ...base, bookable_id: b['Chairs (x50)'], start_at: dt(3,8), end_at: dt(3,18), status: 'CONFIRMED', purpose: 'Seating for competition day' },
    { ...base, bookable_id: b['Fold-out Tables (x10)'], start_at: dt(3,8), end_at: dt(3,18), status: 'CONFIRMED', purpose: 'Registration & canteen tables' },
    { ...base, bookable_id: b['Sarah Mitchell'], start_at: dt(3,10), end_at: dt(3,16), status: 'CONFIRMED', purpose: 'Competition day coach' },
    { ...base, bookable_id: b['James Carter'], start_at: dt(3,10), end_at: dt(3,16), status: 'CONFIRMED', purpose: 'Competition day coach' },

    // ── Next week ──────────────────────────────────────────────────
    { ...base, bookable_id: b['Learn-to-Swim Area'], start_at: dt(7,9), end_at: dt(7,12), status: 'CONFIRMED', purpose: 'Junior swim school — Week 3' },
    { ...base, bookable_id: b['Lane 1'], start_at: dt(7,17), end_at: dt(7,19), status: 'CONFIRMED', purpose: 'Evening squad' },
    { ...base, bookable_id: b['Lane 2'], start_at: dt(7,17), end_at: dt(7,19), status: 'CONFIRMED', purpose: 'Evening squad' },
    { ...base, bookable_id: b['Club Rooms'], start_at: dt(8,19), end_at: dt(8,22), status: 'CONFIRMED', purpose: 'Social night', event_id: e['Club Night'] ?? null },
    { ...base, bookable_id: b['Projector & Screen'], start_at: dt(8,19), end_at: dt(8,22), status: 'CONFIRMED', purpose: 'Club night slideshow' },
    { ...base, bookable_id: b['Chairs (x50)'], start_at: dt(8,18), end_at: dt(8,23), status: 'CONFIRMED', purpose: 'Club night seating' },
    { ...base, bookable_id: b['Court 3'], start_at: dt(9,18), end_at: dt(9,20), status: 'CONFIRMED', purpose: 'Social tennis' },
    { ...base, bookable_id: b['Court 4'], start_at: dt(9,18), end_at: dt(9,20), status: 'CONFIRMED', purpose: 'Social tennis' },

    // ── Past bookings (history) ────────────────────────────────────
    { ...base, bookable_id: b['Club Rooms'], start_at: dt(-30,18), end_at: dt(-30,20), status: 'CONFIRMED', purpose: 'Committee meeting', event_id: e['Committee Meeting'] ?? null },
    { ...base, bookable_id: b['Football Fields'], start_at: dt(-14,9), end_at: dt(-14,17), status: 'CONFIRMED', purpose: 'Pre-season trials' },
    { ...base, bookable_id: b['Cricket Nets'], start_at: dt(-7,14), end_at: dt(-7,17), status: 'CONFIRMED', purpose: 'Batting clinic' },
    { ...base, bookable_id: b['Club Rooms'], start_at: dt(-5,14), end_at: dt(-5,16), status: 'CONFIRMED', purpose: 'Coaches debrief' },
    { ...base, bookable_id: b['Lane 1'], start_at: dt(-3,6), end_at: dt(-3,8), status: 'CONFIRMED', purpose: 'Masters swim — early session' },
    { ...base, bookable_id: b['Marquee'], start_at: dt(-10,8), end_at: dt(-10,18), status: 'CONFIRMED', purpose: 'Open Day marquee' },
    { ...base, bookable_id: b['PA System'], start_at: dt(-10,8), end_at: dt(-10,18), status: 'CONFIRMED', purpose: 'Open Day PA' },
    { ...base, bookable_id: b['James Carter'], start_at: dt(-7,9), end_at: dt(-7,12), status: 'CONFIRMED', purpose: 'Junior coaching' },
    { ...base, bookable_id: b['Sarah Mitchell'], start_at: dt(-7,13), end_at: dt(-7,16), status: 'CONFIRMED', purpose: "Women's squad session" },
    // Cancelled example
    { ...base, bookable_id: b['Court 1'], start_at: dt(-2,10), end_at: dt(-2,12), status: 'CONFIRMED', purpose: 'Social tennis — rained out' },
  ].filter(bk => bk.bookable_id) // skip any nulls if bookable not found

  console.log(`Inserting ${bookings.length} bookings…`)
  const { error } = await db.from('bookings').insert(bookings)
  if (error) console.error('Insert error:', error.message)
  else console.log('Done!')
}

run().catch(e => { console.error(e); process.exit(1) })
