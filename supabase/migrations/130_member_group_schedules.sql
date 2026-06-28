-- Weekly training schedules for member groups.
-- Each row = one recurring weekly slot (e.g. "Monday 3pm-5pm Field 2").
-- Day-of-week follows the JS Date convention: 0=Sunday … 6=Saturday.
create table if not exists member_group_schedules (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  group_id     uuid not null references member_groups(id) on delete cascade,
  day_of_week  int  not null check (day_of_week between 0 and 6),
  start_time   time not null,
  end_time     time not null,
  bookable_id  uuid references bookables(id) on delete set null,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists member_group_schedules_group_id_idx
  on member_group_schedules(group_id);
create index if not exists member_group_schedules_org_id_idx
  on member_group_schedules(org_id);
