-- Per-mode bookable scoping. activity_bookables links the activity (Tennis)
-- to whichever bookables it can be played on (Court 1-4 + their quarters).
-- This table further restricts each mode to a subset:
--   • Tennis · Singles      → linked to Court 1-4 (whole-court only)
--   • Tennis · Junior coach → linked to Quarter 1-4 (sub-venues only)
-- Empty = mode applies to every bookable the activity is linked to.

create table if not exists activity_mode_bookables (
  mode_id     uuid not null references activity_modes(id) on delete cascade,
  bookable_id uuid not null references bookables(id)      on delete cascade,
  primary key (mode_id, bookable_id)
);

create index if not exists activity_mode_bookables_mode_idx on activity_mode_bookables(mode_id);
create index if not exists activity_mode_bookables_bookable_idx on activity_mode_bookables(bookable_id);
