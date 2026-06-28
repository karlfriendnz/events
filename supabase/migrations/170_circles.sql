-- Connecting people: Families & Circles.
-- A circle is a group of linked people. kind='family' = guardians ↔ dependents
-- (guardians manage/book-for/receive-comms for their dependents); kind='circle' =
-- a peer group (members can book-for / view each other but NEVER manage profiles).
-- A person can belong to many circles (incl. two family circles = split families).

create table if not exists circles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  kind        text not null default 'circle' check (kind in ('family', 'circle')),
  created_at  timestamptz not null default now()
);
create index if not exists circles_org_id_idx on circles(org_id);

create table if not exists circle_members (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references circles(id) on delete cascade,
  person_id    uuid not null references persons(id) on delete cascade,
  role         text not null default 'member',  -- family: guardian|dependent ; circle: member
  can_book_for boolean not null default true,   -- may act/book on behalf of co-members
  can_view     boolean not null default true,   -- may track progress / view co-members
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (circle_id, person_id)
);
create index if not exists circle_members_circle_id_idx on circle_members(circle_id);
create index if not exists circle_members_person_id_idx on circle_members(person_id);
