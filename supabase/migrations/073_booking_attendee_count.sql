alter table bookings
  add column if not exists attendee_count integer;
