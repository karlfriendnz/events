-- ============================================================
-- BOOKING TYPES (hourly, half-day, full-day, event, etc.)
-- ============================================================
create table if not exists booking_types (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  name              text not null,
  description       text,
  pricing_model     text not null default 'HOURLY'
                      check (pricing_model in ('HOURLY','FLAT','HALF_DAY','FULL_DAY')),
  min_duration_mins int not null default 60,
  max_duration_mins int,
  sort_order        int not null default 0,
  is_active         bool not null default true,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- PRICING TIERS (user types: Public, Member, Staff, VIP)
-- ============================================================
create table if not exists pricing_tiers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  description text,
  sort_order  int not null default 0,
  is_active   bool not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- LAYOUT CONFIGS (per-layout capacity, buffer, price modifier)
-- ============================================================
create table if not exists bookable_layout_configs (
  id              uuid primary key default gen_random_uuid(),
  bookable_id     uuid not null references bookables(id) on delete cascade,
  layout_name     text not null,
  capacity        int,
  setup_mins      int not null default 0,
  packdown_mins   int not null default 0,
  price_modifier  numeric(5,2) not null default 1.00,
  created_at      timestamptz not null default now(),
  unique (bookable_id, layout_name)
);

-- ============================================================
-- PRICING RULES
-- Rules are matched in priority order. Most specific wins.
-- ============================================================
create table if not exists pricing_rules (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  bookable_id       uuid references bookables(id) on delete cascade,      -- null = all venues
  booking_type_id   uuid references booking_types(id) on delete cascade,  -- null = all types
  pricing_tier_id   uuid references pricing_tiers(id) on delete cascade,  -- null = all tiers
  label             text,                   -- e.g. "Peak weekend rate"
  day_of_week       int[],                  -- 0=Sun..6=Sat; null = any day
  time_from         time,                   -- null = any time
  time_to           time,
  price_per_hour    numeric(10,2),
  flat_price        numeric(10,2),
  half_day_price    numeric(10,2),
  full_day_price    numeric(10,2),
  is_peak           bool not null default false,
  priority          int not null default 0,
  is_active         bool not null default true,
  created_at        timestamptz not null default now()
);

create index if not exists pricing_rules_org_idx on pricing_rules(org_id);

-- ============================================================
-- BOOKING ADD-ONS
-- ============================================================
create table if not exists booking_addons (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  name          text not null,
  description   text,
  price         numeric(10,2) not null default 0,
  price_type    text not null default 'FIXED'
                  check (price_type in ('FIXED','PER_HOUR','PER_PERSON')),
  is_active     bool not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- BOOKING QUOTES
-- ============================================================
create table if not exists booking_quotes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  bookable_id       uuid not null references bookables(id) on delete cascade,
  pricing_tier_id   uuid references pricing_tiers(id),
  booking_type_id   uuid references booking_types(id),
  layout_name       text,
  start_at          timestamptz not null,
  end_at            timestamptz not null,
  status            text not null default 'DRAFT'
                      check (status in ('DRAFT','SENT','ACCEPTED','EXPIRED','CONVERTED')),
  expires_at        timestamptz,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  notes             text,
  subtotal          numeric(10,2) default 0,
  discount_total    numeric(10,2) default 0,
  tax_rate          numeric(5,4) default 0.10,
  tax_amount        numeric(10,2) default 0,
  total             numeric(10,2) default 0,
  created_at        timestamptz not null default now()
);

create table if not exists booking_quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references booking_quotes(id) on delete cascade,
  item_type   text not null
                check (item_type in ('VENUE','ADDON','DISCOUNT','SURCHARGE','TAX')),
  description text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(10,2) not null,
  total       numeric(10,2) not null,
  sort_order  int not null default 0
);

-- ============================================================
-- EXTEND BOOKINGS TABLE
-- ============================================================
alter table bookings add column if not exists booking_type_id     uuid references booking_types(id);
alter table bookings add column if not exists pricing_tier_id     uuid references pricing_tiers(id);
alter table bookings add column if not exists layout_name         text;
alter table bookings add column if not exists quote_id            uuid references booking_quotes(id);
alter table bookings add column if not exists selected_addon_ids  uuid[] default '{}';
alter table bookings add column if not exists total_price         numeric(10,2);
alter table bookings add column if not exists contact_name        text;
alter table bookings add column if not exists contact_email       text;
alter table bookings add column if not exists contact_phone       text;

-- ============================================================
-- SEED DEFAULT DATA
-- ============================================================
do $$
declare v_org_id uuid;
begin
  select id into v_org_id from organisations limit 1;
  if v_org_id is null then return; end if;

  -- Pricing tiers
  insert into pricing_tiers (org_id, name, description, sort_order) values
    (v_org_id, 'Public',       'General public rate',         0),
    (v_org_id, 'Member',       'Club member pricing',          1),
    (v_org_id, 'Staff',        'Staff / admin rate',           2),
    (v_org_id, 'VIP / Partner','Partner or VIP rate',          3)
  on conflict do nothing;

  -- Booking types
  insert into booking_types (org_id, name, pricing_model, min_duration_mins, sort_order) values
    (v_org_id, 'Hourly',   'HOURLY',   60,  0),
    (v_org_id, 'Half Day', 'HALF_DAY', 180, 1),
    (v_org_id, 'Full Day', 'FULL_DAY', 360, 2),
    (v_org_id, 'Event',    'FLAT',     60,  3)
  on conflict do nothing;

  -- Sample add-ons
  insert into booking_addons (org_id, name, description, price, price_type, sort_order) values
    (v_org_id, 'AV Equipment',    'Projector, screen, and PA system',     75.00, 'FIXED',    0),
    (v_org_id, 'Catering Package','Tea, coffee, and light refreshments',  12.00, 'PER_PERSON', 1),
    (v_org_id, 'Cleaning Fee',    'Post-event professional clean',        120.00, 'FIXED',   2),
    (v_org_id, 'Security Staff',  'Licensed security officer',            45.00, 'PER_HOUR', 3)
  on conflict do nothing;
end $$;
