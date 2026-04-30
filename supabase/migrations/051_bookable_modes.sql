-- Venue-level modes: named activities that use specific sections of a venue.
-- e.g. "Pickleball" → sections ["Half 1"], "Dancing" → sections ["Half 2"]
-- Multiple modes can run simultaneously when they use non-overlapping sections.
create table if not exists bookable_modes (
  id          uuid primary key default gen_random_uuid(),
  bookable_id uuid not null references bookables(id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  min_players int,
  max_players int,
  sort_order  int  not null default 0
);

create index if not exists bookable_modes_bookable_idx on bookable_modes(bookable_id);

-- Let bookings optionally capture which mode was booked
alter table bookings add column if not exists mode_id uuid references bookable_modes(id);
