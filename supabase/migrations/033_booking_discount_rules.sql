-- Automatic discount rules triggered by booking quantity/conditions
--
-- Example — 2 full courts at same time → 20% off:
--   min_items=2, apply_to_granularity='FULL', discount_percent=20, same_session=true
create table if not exists booking_discount_rules (
  id                      uuid primary key default gen_random_uuid(),
  bookable_id             uuid references bookables(id) on delete cascade,  -- null = org-wide
  org_id                  uuid references organisations(id) on delete cascade,
  name                    text not null,
  description             text,
  discount_percent        numeric(5,2) not null,
  min_items               int  not null default 2,         -- min concurrent bookings to trigger
  apply_to_granularity    text,                            -- 'FULL','HALF','THIRD','QUARTER' — null = any
  apply_to_layout_ids     uuid[] not null default '{}',    -- empty = any layout
  same_session            bool not null default true,      -- must overlap in time
  is_active               bool not null default true,
  sort_order              int  not null default 0,
  created_at              timestamptz not null default now()
);

create index if not exists discount_rules_bookable_idx on booking_discount_rules(bookable_id);
create index if not exists discount_rules_org_idx     on booking_discount_rules(org_id);
