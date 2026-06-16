-- ============================================================
-- 136_disciplines_memberships.sql
-- Disciplines = canonical categories/grades defined by a governing body (NSO),
-- that local club groups/events map back to. e.g. one club's "Karl's Seniors"
-- and another's "Blue Seniors" both map to NZC's "Seniors" discipline, so the
-- NSO can aggregate across clubs. A local group/event can map to disciplines
-- from MULTIPLE NSOs (many-to-many).
--
-- Plus person_memberships: a person's affiliation to a club (org) + sport +
-- discipline. Enables one person across multiple clubs/sports, reportable up
-- the hierarchy (org_ancestors of each membership's org).
-- ============================================================

create table if not exists disciplines (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,  -- owning governing body
  name        text not null,                 -- e.g. "Seniors", "U15", "Premier"
  sport       text,                           -- e.g. "Cricket", "Netball"
  code        text,                           -- optional short code
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists disciplines_org_idx on disciplines(org_id);

-- Map a local member_group to NSO discipline(s) — many-to-many, multi-NSO.
create table if not exists member_group_disciplines (
  group_id      uuid not null references member_groups(id) on delete cascade,
  discipline_id uuid not null references disciplines(id) on delete cascade,
  primary key (group_id, discipline_id)
);

-- Map a local event to NSO discipline(s) — many-to-many, multi-NSO.
create table if not exists event_disciplines (
  event_id      uuid not null references events(id) on delete cascade,
  discipline_id uuid not null references disciplines(id) on delete cascade,
  primary key (event_id, discipline_id)
);

-- A person's affiliation to a club (org) + sport/discipline. Cross-club + multi-sport.
create table if not exists person_memberships (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references persons(id) on delete cascade,
  org_id        uuid not null references organisations(id) on delete cascade,  -- the club
  discipline_id uuid references disciplines(id) on delete set null,
  sport         text,
  role          text not null default 'PLAYER',  -- PLAYER / COACH / OFFICIAL / ADMIN
  status        text not null default 'ACTIVE',
  created_at    timestamptz not null default now()
);
create index if not exists person_memberships_person_idx on person_memberships(person_id);
create index if not exists person_memberships_org_idx on person_memberships(org_id);
