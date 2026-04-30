-- Booking discounts: org-scoped rules that can be restricted to specific activities.
-- Shape mirrors event discounts (conditions jsonb, modifier_type/value, validity window)
-- with a usage cap (max_uses / uses_count) enforced at apply-time.

create table if not exists booking_discounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  form_text text,
  modifier_type text not null default 'PERCENT' check (modifier_type in ('PERCENT', 'FLAT')),
  modifier_value numeric(10, 2) not null default 0,
  apply_to text not null default 'BOOKING' check (apply_to in ('BOOKING', 'ADDONS', 'BOOKING_AND_ADDONS')),
  conditions jsonb not null default '[]'::jsonb,
  valid_from timestamptz,
  valid_until timestamptz,
  max_uses integer,
  uses_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_discounts_org_idx on booking_discounts(org_id);
create index if not exists booking_discounts_active_idx on booking_discounts(org_id, is_active);

-- Join table: empty set = discount applies to all activities in the org.
create table if not exists booking_discount_activities (
  discount_id uuid not null references booking_discounts(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  primary key (discount_id, activity_id)
);

create index if not exists booking_discount_activities_activity_idx
  on booking_discount_activities(activity_id);
