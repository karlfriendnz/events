-- Coach bookings + bundled equipment.
--
-- Two new join-style tables:
--   1. activity_mode_resources — when a mode (e.g. "Private swim lesson")
--      requires a venue alongside the person being booked, list every
--      venue option here. The booker picks the coach + time; the system
--      auto-resolves the first available venue from this pool at submit
--      and writes a child `bookings` row (parent_booking_id) so both
--      calendars block atomically.
--   2. booking_items — fungible equipment (footballs, cones, nets) that's
--      part of one booking. Not separate bookings: an item with qty=4
--      reserves 4 of that bookable's `max_concurrent` capacity for the
--      window. Standalone item rentals (lockers, projectors) keep using
--      one-booking-per-unit and don't touch this table.

create table if not exists activity_mode_resources (
  mode_id      uuid not null references activity_modes(id) on delete cascade,
  bookable_id  uuid not null references bookables(id)      on delete cascade,
  sort_order   int  not null default 0,
  primary key (mode_id, bookable_id)
);

create index if not exists activity_mode_resources_bookable_idx
  on activity_mode_resources(bookable_id);

create table if not exists booking_items (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null references bookings(id)  on delete cascade,
  bookable_id  uuid not null references bookables(id) on delete restrict,
  quantity     int  not null check (quantity > 0),
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists booking_items_booking_idx  on booking_items(booking_id);
-- Capacity-check hot path: looking up overlapping bookings per item.
create index if not exists booking_items_bookable_idx on booking_items(bookable_id);
