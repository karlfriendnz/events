// GET /api/v1/bookings/for-bookables?bookableIds=csv&overlapStart=&overlapEnd=&from=&to=
//   &excludeCancelled=1&status= — the flat bookings on a SET of bookables, for the
// overlap/clash pre-flights (wizard, scheduler, item booker) and by-bookable calendar
// windows (availability editor, sub-venue scheduler).
//   overlapStart/overlapEnd → TRUE interval overlap (start_at < overlapEnd AND
//     end_at > overlapStart).
//   from/to → a window against start_at.
// The bookable ids are org-owned, so this stays tenant-safe without an explicit orgId.
// A venue still owned by the OLD platform is booked by an event over THERE, and
// this module has no row for it — so without the legacy pass below such a venue
// always reads "available" no matter what is already in it. That is worse than
// showing nothing: it actively tells staff a booked venue is free.
import { listBookingsForBookables } from '../../../db/repositories/bookings'
import { bookingListSchema } from '../../../../shared/contracts/booking'
import { legacyClub, legacy, isLegacyId, LEGACY_ID_PREFIX, clubTimezone, wallClockMs } from '../../../utils/legacy'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const bookableIds = typeof query.bookableIds === 'string' && query.bookableIds
    ? query.bookableIds.split(',').filter(Boolean)
    : []
  if (!bookableIds.length) return bookingListSchema.parse([])
  const rows = await listBookingsForBookables(bookableIds, {
    overlapStart: typeof query.overlapStart === 'string' ? query.overlapStart : undefined,
    overlapEnd: typeof query.overlapEnd === 'string' ? query.overlapEnd : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    excludeCancelled: query.excludeCancelled === '1' || query.excludeCancelled === 'true',
    status: typeof query.status === 'string' ? query.status : undefined,
  })
  // Occupancy of the old platform's venues, expressed as bookings so every
  // caller (availability map, clash pre-flight) treats them the same way.
  const legacyIds = bookableIds.filter(isLegacyId)
  const club = legacyClub()
  if (legacyIds.length && club) {
    const overlapStart = typeof query.overlapStart === 'string' ? query.overlapStart : undefined
    const overlapEnd = typeof query.overlapEnd === 'string' ? query.overlapEnd : undefined
    const from = overlapStart || (typeof query.from === 'string' ? query.from : undefined)
    const to = overlapEnd || (typeof query.to === 'string' ? query.to : undefined)

    if (from && to) {
      try {
        const wanted = new Set(legacyIds)
        // The old platform filters by DATE, so ask for the day either side and
        // do the precise time overlap here.
        const day = (v: string) => new Date(v).toISOString().slice(0, 10)
        const events = await legacy.events(club, day(from), day(new Date(new Date(to).getTime() + 864e5).toISOString()))

        // Compare in the CLUB's wall clock. The bounds arriving here may be
        // absolute (…Z); the legacy rows are wall clock with no zone. Reading
        // both in the server's zone happens to work on a machine set to the
        // club's and silently finds NO clashes anywhere else — a booked venue
        // would report itself free.
        const tz = await clubTimezone(club)
        const startMs = wallClockMs(from, tz)
        const endMs = wallClockMs(to, tz)

        for (const e of events) {
          if (!e.venueID || !e.date) continue
          const id = `${LEGACY_ID_PREFIX}${e.venueID}`
          if (!wanted.has(id)) continue

          const s = new Date(`${e.date}T${e.startTime || '00:00:00'}`).getTime()
          const en = new Date(`${e.endDate || e.date}T${e.endTime || '23:59:59'}`).getTime()
          // TRUE overlap, the same test the repository applies.
          if (!(s < endMs && en > startMs)) continue

          rows.push({
            id: `${LEGACY_ID_PREFIX}booking-${e.id}`,
            orgId: club.orgId ?? '',
            bookableId: id,
            eventId: null, sessionId: null,
            type: 'EVENT', status: 'CONFIRMED',
            // Passed through as the old platform's own wall-clock time, NOT
            // via toISOString() — that would stamp the SERVER's timezone onto a
            // club's local time and shift every legacy booking by the offset
            // once this runs anywhere but a machine set to the club's zone.
            startAt: `${e.date}T${e.startTime || '00:00:00'}`,
            endAt: `${e.endDate || e.date}T${e.endTime || '23:59:59'}`,
            notes: e.name || null,
            contactName: null, contactEmail: null, contactPhone: null,
            purpose: e.name || null,
            isAllDay: !!e.allDay,
            activityId: null, activityModeId: null, bookableModeId: null, modeId: null,
            selectedAddons: [], attendeeCount: null, bookingDiscountId: null,
            discountAmount: 0, customFields: {}, parentBookingId: null,
            isRecurring: false, subjectPersonId: null, accessCode: null,
          } as any)
        }
      } catch (e: any) {
        // Never let the old system's availability take down the new one's.
        console.warn('[legacy] could not check venue availability:', e?.message || e)
      }
    }
  }

  return bookingListSchema.parse(rows)
})
