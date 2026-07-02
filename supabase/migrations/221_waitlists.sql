-- Waitlists. A waitlist is a shared queue of people waiting for a spot. It can be
-- connected to MANY groups (e.g. "Tuesday 4pm" + "Thursday 4pm" are the same class
-- on different days → both connect to one waitlist), so a spot opening in ANY
-- connected group can be filled from the one queue.
--
-- Connection is one waitlist → many groups (a group has at most one waitlist).
create table if not exists waitlists (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  name       text not null,
  notes      text,
  created_at timestamptz default now()
);
create index if not exists waitlists_org_idx on waitlists(org_id);

-- A group connects to at most one waitlist; many groups share one.
alter table member_groups add column if not exists waitlist_id uuid references waitlists(id) on delete set null;
create index if not exists member_groups_waitlist_idx on member_groups(waitlist_id);

-- People on a waitlist, in order. status: waiting | contacted | placed | declined.
create table if not exists waitlist_entries (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  waitlist_id uuid not null references waitlists(id) on delete cascade,
  person_id   uuid not null references persons(id) on delete cascade,
  status      text not null default 'waiting',
  notes       text,
  sort_order  int  not null default 0,
  created_at  timestamptz default now(),
  unique(waitlist_id, person_id)
);
create index if not exists waitlist_entries_waitlist_idx on waitlist_entries(waitlist_id);
create index if not exists waitlist_entries_person_idx   on waitlist_entries(person_id);
