-- Let a booking discount optionally scope to specific activity modes.
-- Empty set = discount applies to all modes (within whatever activities are selected).

create table if not exists booking_discount_activity_modes (
  discount_id uuid not null references booking_discounts(id) on delete cascade,
  activity_mode_id uuid not null references activity_modes(id) on delete cascade,
  primary key (discount_id, activity_mode_id)
);

create index if not exists booking_discount_modes_mode_idx
  on booking_discount_activity_modes(activity_mode_id);
