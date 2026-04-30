-- Activities: org-level named activities (Tennis, Badminton, 5-a-side…)
-- Memberships grant access to activities; activities happen at venues.
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  name        text not null,
  description text,
  color       text not null default '#6366F1',
  icon        text not null default 'pi-bolt',
  status      text not null default 'ACTIVE',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists activities_org_idx on activities(org_id);

-- Which venues support this activity
create table if not exists activity_bookables (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  bookable_id uuid not null references bookables(id) on delete cascade,
  unique(activity_id, bookable_id)
);
