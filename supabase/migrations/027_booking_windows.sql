-- Booking windows: define when and how a bookable can be booked
create table if not exists booking_windows (
  id               uuid primary key default gen_random_uuid(),
  bookable_id      uuid not null references bookables(id) on delete cascade,
  name             text not null,
  window_type      text not null default 'OPEN'
                     check (window_type in ('OPEN','SLOTTED','FIXED')),
  days_of_week     int[] not null default '{0,1,2,3,4,5,6}',
  start_time       time not null,
  end_time         time not null,
  slot_duration_mins int,           -- OPEN / SLOTTED: e.g. 60
  buffer_mins      int not null default 0,
  capacity         int not null default 1,
  sort_order       int not null default 0,
  is_active        bool not null default true,
  created_at       timestamptz not null default now()
);

-- Fixed slots within a FIXED window
create table if not exists booking_window_slots (
  id          uuid primary key default gen_random_uuid(),
  window_id   uuid not null references booking_windows(id) on delete cascade,
  slot_start  time not null,
  slot_end    time not null,
  capacity    int not null default 1,
  label       text,
  sort_order  int not null default 0
);

-- Per-pricing-tier config for a window
create table if not exists booking_window_tiers (
  id               uuid primary key default gen_random_uuid(),
  window_id        uuid not null references booking_windows(id) on delete cascade,
  pricing_tier_id  uuid not null references pricing_tiers(id) on delete cascade,
  price            numeric(10,2) not null default 0,
  price_type       text not null default 'PER_SLOT'
                     check (price_type in ('PER_SLOT','PER_HOUR','FIXED','FREE')),
  allowed_addon_ids uuid[] not null default '{}',
  restrictions     text,
  can_book         bool not null default true,
  unique (window_id, pricing_tier_id)
);

create index if not exists booking_windows_bookable_idx on booking_windows(bookable_id);
create index if not exists booking_window_slots_window_idx on booking_window_slots(window_id);
create index if not exists booking_window_tiers_window_idx on booking_window_tiers(window_id);
