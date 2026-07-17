-- AFFILIATION IS A HANDSHAKE, NOT A CLAIM (17 Jul 2026, per Karl).
--
-- Until now a club affiliated to a governing body UNILATERALLY and SILENTLY: it
-- picked the body from a dropdown in <OrgSportsEditor> and saved. The body was
-- never asked, was never told, and had no register of its own clubs. Anyone could
-- claim to be affiliated with Football — and the claim alone handed Football's
-- fields authority over that club's members' data. The governing relationship was
-- the one thing the governing body had no say in.
--
-- The model, in Karl's words minus the word "download": affiliation is a SWITCH,
-- not a transfer. The club requests, the body approves, and from that moment the
-- body's fields / disciplines / terminology simply APPLY — live, via the existing
-- read-time joins. Nothing is copied, so nothing can go stale and there is no
-- sync to break. The only thing that lands in the club's own database is its
-- person types (seeded pre-linked on approval), because renaming them is exactly
-- what ownership means.
--
-- Revoking stops the MANDATE, never the DATA: a body can end the relationship and
-- its fields stop applying and stop flagging, but every Football NZ ID already
-- recorded stays. It is the club's record of something that was true.

alter table org_sports add column if not exists affiliation_status text not null default 'pending';
alter table org_sports drop constraint if exists org_sports_affiliation_status_check;
alter table org_sports add constraint org_sports_affiliation_status_check
  check (affiliation_status in ('pending', 'approved', 'revoked'));

alter table org_sports add column if not exists requested_at timestamptz default now();
alter table org_sports add column if not exists decided_at  timestamptz;
alter table org_sports add column if not exists decided_by  uuid references auth.users(id) on delete set null;

-- Backfill: every affiliation that already exists was made under the old
-- unilateral rules and is in active use. Approve it — a status column must not
-- retroactively switch a working club's inheritance off.
update org_sports set affiliation_status = 'approved', decided_at = coalesce(decided_at, now())
where affiliation_status <> 'approved';

-- Only meaningful when there IS a body. A club may run a sport nobody governs
-- (nso_org_id null) — that is not "pending", it just has no counterparty, and the
-- resolver ignores it either way.
comment on column org_sports.affiliation_status is
  'pending | approved | revoked. Only meaningful when nso_org_id is set. ONLY approved rows inherit — see org_sport_ancestors.';

create index if not exists org_sports_status_idx on org_sports(nso_org_id, affiliation_status);

-- ── THE LOAD-BEARING CHANGE ──
-- Without this the approval is theatre: org_sport_ancestors treated ANY row with
-- an nso_org_id as inheritance, so a merely-REQUESTED affiliation would already
-- pull down the body's fields. Identical to migration 148's definition except for
-- the affiliation_status filter in `starts`.
create or replace function org_sport_ancestors(p_org uuid, p_sport text default null)
returns table (id uuid, name text, type text, org_level text, parent_id uuid, depth int, via_sport text)
language sql stable as $$
  with recursive starts as (
    select s.nso_org_id, s.sport
    from org_sports s
    where s.org_id = p_org
      and s.nso_org_id is not null
      and s.affiliation_status = 'approved'      -- ← a claim is not an affiliation
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
