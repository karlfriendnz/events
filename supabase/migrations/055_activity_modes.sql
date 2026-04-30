create table if not exists activity_modes (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  name        text not null,
  description text,
  color       text,
  sort_order  int  not null default 0,
  created_at  timestamptz default now()
);

create index if not exists activity_modes_activity_idx on activity_modes(activity_id);

-- Let bookings capture which activity mode was chosen
alter table bookings add column if not exists activity_mode_id uuid references activity_modes(id) on delete set null;
