-- ============================================================
-- 134_org_hierarchy.sql
-- Multi-level organisation hierarchy (Club -> Regional -> Association -> National).
-- Additive + backward compatible: keeps organisations.type ('NSO'|'CLUB') working
-- (any non-club level still maps to type='NSO' = "is a governing body"), and adds
-- org_level for the precise rung. parent_id (already present) expresses the chain.
-- No Events tables touched.
-- ============================================================

-- 1. Precise hierarchy level on each org.
alter table organisations
  add column if not exists org_level text not null default 'CLUB'
    check (org_level in ('CLUB', 'REGIONAL', 'ASSOCIATION', 'NATIONAL'));

-- Backfill from the legacy binary type: NSO -> NATIONAL, CLUB -> CLUB.
update organisations set org_level = 'NATIONAL' where type = 'NSO' and org_level = 'CLUB';

-- Index the hierarchy link (was unindexed) — hot path for ancestor/descendant walks.
create index if not exists organisations_parent_id_idx on organisations(parent_id);

-- Rank helper for ordering levels (NATIONAL highest).
create or replace function org_level_rank(p_level text)
returns int language sql immutable as $$
  select case p_level
    when 'NATIONAL'    then 3
    when 'ASSOCIATION' then 2
    when 'REGIONAL'    then 1
    else 0 end;
$$;

-- 2. Ancestors: walk parent_id UP from an org (excludes the org itself).
--    depth 1 = immediate parent, increasing upward. Depth-capped to avoid cycles.
create or replace function org_ancestors(p_org uuid)
returns table (id uuid, name text, type text, org_level text, parent_id uuid, depth int)
language sql stable as $$
  with recursive chain as (
    select o.id, o.name, o.type, o.org_level, o.parent_id, 0 as depth
    from organisations o
    where o.id = p_org
    union all
    select o.id, o.name, o.type, o.org_level, o.parent_id, c.depth + 1
    from organisations o
    join chain c on o.id = c.parent_id
    where c.depth < 20
  )
  select id, name, type, org_level, parent_id, depth
  from chain
  where id <> p_org
  order by depth;
$$;

-- 3. Descendants: walk parent_id DOWN from an org (excludes the org itself).
--    depth 1 = direct children, increasing downward. Depth-capped to avoid cycles.
create or replace function org_descendants(p_org uuid)
returns table (id uuid, name text, type text, org_level text, parent_id uuid, depth int)
language sql stable as $$
  with recursive tree as (
    select o.id, o.name, o.type, o.org_level, o.parent_id, 0 as depth
    from organisations o
    where o.id = p_org
    union all
    select o.id, o.name, o.type, o.org_level, o.parent_id, t.depth + 1
    from organisations o
    join tree t on o.parent_id = t.id
    where t.depth < 20
  )
  select id, name, type, org_level, parent_id, depth
  from tree
  where id <> p_org
  order by depth, name;
$$;
