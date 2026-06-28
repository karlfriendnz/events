-- Mode-level required equipment.
--
-- A coach defines on the mode itself: "every booking of this mode also
-- locks N of these items." At booking time the wizard auto-inserts
-- booking_items rows for each required item — the customer never sees
-- the picker (it's part of what they're paying for).
--
-- Different concept from `activity_mode_resources` which is venue pool
-- resolution (pick one of N equivalent spaces). Required items are
-- inventory reservations with explicit quantities.

create table if not exists activity_mode_required_items (
  id           uuid primary key default gen_random_uuid(),
  mode_id      uuid not null references activity_modes(id) on delete cascade,
  bookable_id  uuid not null references bookables(id)      on delete cascade,
  quantity     int  not null check (quantity > 0),
  sort_order   int  not null default 0,
  unique (mode_id, bookable_id)
);

create index if not exists activity_mode_required_items_mode_idx
  on activity_mode_required_items(mode_id);
create index if not exists activity_mode_required_items_bookable_idx
  on activity_mode_required_items(bookable_id);
