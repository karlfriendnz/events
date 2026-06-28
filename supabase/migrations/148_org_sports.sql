-- ============================================================
-- 148_org_sports.sql
-- A club's sports, each connected to a governing body (NSO). Phase 1 — foundation.
--
-- Model (sport-first):
--   1. A club runs MULTIPLE sports (Cricket, Netball, …)            -> org_sports rows
--   2. Each club-sport connects to one governing body (NSO)         -> org_sports.nso_org_id
--   3. An event/group picks a sport, which resolves the NSO, then
--      a discipline from that NSO's disciplines for the sport       -> existing
--      event_disciplines / member_group_disciplines (migration 136)
--
-- Why this and not a bigger hierarchy change: the governing bodies above a club
-- (Regional -> Association -> National) stay single-parent trees via
-- organisations.parent_id. Only the CLUB's entry point becomes many-to-many, and
-- it does so PER SPORT. Each org_sports row resolves a full governing chain by
-- walking parent_id up from its nso_org_id.
--
-- parent_id is KEPT as the PRIMARY structural parent (terminology, branding,
-- permissions and the breadcrumb still read it unchanged). The primary sport
-- (is_primary = true) is the terminology/branding source and mirrors parent_id.
--
-- Additive + non-breaking: nothing reads org_sports yet (the sports editor and
-- discipline-aware resolvers are Phase 2/3). disciplines, event_disciplines,
-- member_group_disciplines and person_memberships already exist (migration 136).
-- The legacy organisations.sports text[] is superseded by this table but left in
-- place; the backfill seeds from it.
-- ============================================================

-- 1. The sports a club runs, each optionally governed by an NSO.
create table if not exists org_sports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,   -- the club
  sport       text not null,                                                  -- the sport (e.g. "Cricket") — matches disciplines.sport
  nso_org_id  uuid references organisations(id) on delete set null,           -- governing body for this sport (NULL = not yet connected)
  is_primary  boolean not null default false,                                 -- primary sport — source of inherited terminology + branding
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  constraint org_sports_no_self check (nso_org_id is null or nso_org_id <> org_id),
  unique (org_id, sport)
);

-- At most one primary sport per club.
create unique index if not exists org_sports_one_primary
  on org_sports(org_id) where is_primary;

create index if not exists org_sports_org_idx on org_sports(org_id);
create index if not exists org_sports_nso_idx on org_sports(nso_org_id);

-- 2. Backfill: each club that already has a parent gets one PRIMARY sport row
--    connected to that parent, so the current single governing chain is preserved
--    as the club's primary sport. Seeded as 'General'; real sport names are set
--    via the Phase 2 editor (and additional sports added there).
insert into org_sports (org_id, sport, nso_org_id, is_primary, sort_order)
select o.id, 'General', o.parent_id, true, 0
from organisations o
where o.parent_id is not null
on conflict (org_id, sport) do nothing;

-- 3. Sport-scoped ancestor walk.
--    For a club + (optional) sport, return every governing body to inherit from:
--    each matching connected sport's NSO PLUS that NSO's own parent_id ancestors,
--    deduped to the shallowest depth per org. p_sport NULL = union across ALL of
--    the club's connected sports (used by the Fields page to show everything,
--    labelled by which body/sport it came from).
create or replace function org_sport_ancestors(p_org uuid, p_sport text default null)
returns table (id uuid, name text, type text, org_level text, parent_id uuid, depth int, via_sport text)
language sql stable as $$
  with recursive starts as (
    select s.nso_org_id, s.sport
    from org_sports s
    where s.org_id = p_org
      and s.nso_org_id is not null
      and (p_sport is null or s.sport = p_sport)
  ),
  chain as (
    -- depth 1 = the connected governing body itself
    select o.id, o.name, o.type, o.org_level, o.parent_id, 1 as depth, st.sport as via_sport
    from starts st
    join organisations o on o.id = st.nso_org_id
    union all
    -- walk up that body's own parent chain
    select o.id, o.name, o.type, o.org_level, o.parent_id, c.depth + 1, c.via_sport
    from chain c
    join organisations o on o.id = c.parent_id
    where c.depth < 20
  )
  select distinct on (id) id, name, type, org_level, parent_id, depth, via_sport
  from chain
  order by id, depth;
$$;
