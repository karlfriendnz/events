import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hqhvuwfhnxrkeeoevvtx.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaHZ1d2Zobnhya2Vlb2V2dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0ODU0OSwiZXhwIjoyMDkxNzI0NTQ5fQ.NKc_dawyUemyBWTJEPJtxM2F1KP8cn4yWtQR_lBE4-Q'
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000002'

const db = createClient(SUPABASE_URL, SERVICE_KEY)

function d(offsetDays, hour = 9, minute = 0) {
  const dt = new Date()
  dt.setDate(dt.getDate() + offsetDays)
  dt.setHours(hour, minute, 0, 0)
  return dt.toISOString()
}

async function run() {
  // ── Find the Administration category ──────────────────────────
  const { data: cats } = await db.from('categories')
    .select('id, name').eq('org_id', DEFAULT_ORG_ID).eq('name', 'Administration').single()
  if (!cats?.id) { console.error('Administration category not found — run Seed Demo Events first'); process.exit(1) }
  const adminCatId = cats.id

  // ── Find Club Rooms bookable ───────────────────────────────────
  const { data: clubRooms } = await db.from('bookables')
    .select('id').eq('org_id', DEFAULT_ORG_ID).eq('name', 'Club Rooms').single()
  const clubRoomsId = clubRooms?.id ?? null

  // ── Create 3 Committee Meeting events (2 past, 1 upcoming) ────
  const committeeDates = [-57, -27, 3]
  const committeeIds = []
  for (const offset of committeeDates) {
    const { data: cm, error } = await db.from('events').insert({
      org_id: DEFAULT_ORG_ID,
      status: 'PUBLISHED',
      is_public: true,
      style: 'BASIC',
      category_id: adminCatId,
      title: 'Committee Meeting',
      description: 'Monthly committee meeting to review upcoming events and discuss club operations.',
      start_at: d(offset, 18, 0),
      end_at: d(offset, 20, 0),
      location_type: clubRoomsId ? 'BOOKABLE' : 'NONE',
      bookable_id: clubRoomsId,
    }).select('id').single()
    if (error) { console.error('Event insert error:', error.message); process.exit(1) }
    committeeIds.push({ id: cm.id, offset })
    console.log(`Created Committee Meeting (offset ${offset}): ${cm.id}`)
  }

  // ── Create 10 committee member persons ────────────────────────
  const { data: committeePersons, error: personErr } = await db.from('persons').insert([
    { org_id: DEFAULT_ORG_ID, first_name: 'Margaret', last_name: 'Holloway',  email: 'margaret.holloway@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'David',    last_name: 'Tran',      email: 'david.tran@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Priya',    last_name: 'Sharma',    email: 'priya.sharma@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Lachlan',  last_name: 'Reid',      email: 'lachlan.reid@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Fiona',    last_name: 'Nguyen',    email: 'fiona.nguyen@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Craig',    last_name: 'Watkins',   email: 'craig.watkins@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Sandra',   last_name: 'Okafor',    email: 'sandra.okafor@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Michael',  last_name: 'Costa',     email: 'michael.costa@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Bree',     last_name: 'Lawson',    email: 'bree.lawson@sportclub.com' },
    { org_id: DEFAULT_ORG_ID, first_name: 'Tom',      last_name: 'Ihejirika', email: 'tom.ihejirika@sportclub.com' },
  ]).select('id')
  if (personErr) { console.error('Persons insert error:', personErr.message); process.exit(1) }
  console.log(`Created ${committeePersons.length} committee members`)

  // ── Add all 10 as CONFIRMED invitees + simulate attendance ────
  const attendanceRates = [0.9, 0.8, null] // null = upcoming, no attendance yet
  for (let i = 0; i < committeeIds.length; i++) {
    const { id: eventId } = committeeIds[i]
    const { data: invitees, error: invErr } = await db.from('invitees').insert(
      committeePersons.map(p => ({ event_id: eventId, person_id: p.id, status: 'CONFIRMED' }))
    ).select('id, person_id')
    if (invErr) { console.error(`Invitees insert error (meeting ${i+1}):`, invErr.message); process.exit(1) }
    console.log(`Added ${invitees.length} invitees to meeting ${i+1}`)

    const rate = attendanceRates[i]
    if (invitees.length && rate !== null) {
      const attending = invitees.filter(() => Math.random() < rate)
      if (attending.length) {
        const { error: attErr } = await db.from('attendance').insert(
          attending.map(inv => ({
            event_id: eventId,
            person_id: inv.person_id,
            session_id: null,
            attended: true,
          }))
        )
        if (attErr) { console.error(`Attendance insert error (meeting ${i+1}):`, attErr.message) }
        else console.log(`Recorded attendance for ${attending.length}/10 people at meeting ${i+1}`)
      }
    } else if (rate === null) {
      console.log(`Meeting ${i+1} is upcoming — no attendance recorded`)
    }
  }

  console.log('\nDone! Committee meeting data seeded successfully.')
}

run().catch(e => { console.error(e); process.exit(1) })
