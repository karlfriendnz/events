-- Time-based restrictions per pricing tier
-- ALLOWED: this tier may only book within this window
-- BLOCKED: this tier may not book within this window
--
-- Example — Junior tier: ALLOWED 15:00–19:00, any day
create table if not exists pricing_tier_restrictions (
  id               uuid primary key default gen_random_uuid(),
  pricing_tier_id  uuid not null references pricing_tiers(id) on delete cascade,
  days_of_week     int[] not null default '{0,1,2,3,4,5,6}',
  start_time       time  not null,
  end_time         time  not null,
  restriction_type text  not null default 'ALLOWED'
                     check (restriction_type in ('ALLOWED','BLOCKED')),
  label            text,
  created_at       timestamptz not null default now()
);

create index if not exists tier_restrictions_tier_idx on pricing_tier_restrictions(pricing_tier_id);
