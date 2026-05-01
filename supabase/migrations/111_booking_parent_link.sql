-- Slot-aware bookings: when a configuration slot like "Half A = {Q1, Q2}"
-- gets booked, we insert one row per member sub-venue so each one's
-- availability is correctly blocked. The first row is the primary; the
-- rest point at it via parent_booking_id so we can group them in the UI
-- and propagate edits/cancellations across the set.
alter table bookings
  add column if not exists parent_booking_id uuid references bookings(id) on delete cascade;

create index if not exists bookings_parent_booking_idx
  on bookings(parent_booking_id);
