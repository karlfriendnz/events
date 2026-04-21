-- Per-layout pricing overrides within a booking window
-- Allows e.g. "after 10pm: Full Court $30/hr, Half Court $18/hr, Third $12/hr"
-- independently of the base layout pricing in bookable_layout_tiers
create table if not exists booking_window_layout_prices (
  id          uuid primary key default gen_random_uuid(),
  window_id   uuid not null references booking_windows(id)  on delete cascade,
  layout_id   uuid not null references bookable_layouts(id) on delete cascade,
  price       numeric(10,2) not null default 0,
  price_type  text not null default 'PER_HOUR'
                check (price_type in ('FIXED','PER_HOUR','PER_PERSON','FREE')),
  unique (window_id, layout_id)
);

create index if not exists window_layout_prices_window_idx on booking_window_layout_prices(window_id);
create index if not exists window_layout_prices_layout_idx on booking_window_layout_prices(layout_id);

-- Also extend bookings table to capture the layout_id FK (currently only layout_name text)
alter table bookings      add column if not exists layout_id uuid references bookable_layouts(id);
alter table booking_quotes add column if not exists layout_id uuid references bookable_layouts(id);
