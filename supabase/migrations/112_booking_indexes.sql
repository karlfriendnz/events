-- Compound index for "bookings on this venue at this time" — the most
-- common availability query, hit by every calendar render and now by the
-- BookingScheduler conflict pre-flight. The existing
-- bookings_bookable_id_idx covers the equality filter alone, but Postgres
-- still has to fetch every row for that bookable to apply the time
-- predicate. The compound index lets it index-skip into the time range.
create index if not exists bookings_bookable_start_idx
  on bookings(bookable_id, start_at);

-- Activity-scoped lookups (the bookables index page joins through
-- activity_id when reporting how many bookings live on each activity,
-- and the mode editor reads bookings filtered by activity for capacity
-- views). No index existed before this.
create index if not exists bookings_activity_id_idx
  on bookings(activity_id);

-- Status-filtered lookups for the bookings list — most queries exclude
-- CANCELLED rows, so a partial index on the active statuses pays off
-- when the cancelled set grows over time.
create index if not exists bookings_active_status_idx
  on bookings(status, start_at)
  where status in ('PENDING', 'CONFIRMED');
