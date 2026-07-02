-- ============================================================
-- Backfill: convert the member_groups.parent_id hierarchy into Codes.
--
-- Codes (migration 205) replace group nesting. Every group that HAS children is
-- turned into a group_codes row; its direct children get code_id pointing at the
-- new code. Codes themselves nest by wiring group_codes.parent_id from the code
-- created out of the group's own parent.
--
-- For each container group P (a group with ≥1 child), shallowest-first so a
-- container's own parent code already exists when we set this code's parent_id:
--   1. Insert a group_codes row (name/color/term_id/sort_order/org_id copied from
--      P), with parent_id = the code created from P.parent_id (null if P's parent
--      wasn't itself a container).
--   2. Re-point every direct child of P: member_groups.code_id = the new code.
--   3. Classify P:
--        • PURE container  — P has zero member_group_memberships, zero
--          member_group_schedules and zero events (events.member_group_id = P.id):
--          delete the P row (its identity now lives on as the Code).
--        • MIXED node — P also has content of its own: KEEP P as a group but make
--          it a leaf under its grandparent's code (code_id = the code created from
--          P.parent_id). P's children still hang off the code created from P.
--
-- After processing an org, retire parent_id in favour of code_id
-- (member_groups.parent_id = null for every group in that org).
--
-- Idempotency: an org is only processed if it has NO group_codes rows yet, so
-- re-running is a no-op. (NHG data, verified: 5 parent groups, all pure
-- containers, max depth 2 — but this is written generally for any depth/shape.)
-- ============================================================

do $$
declare
  o           record;   -- an org to convert
  p           record;   -- a container group, shallowest-first
  code_parent uuid;     -- the code created from P's parent (or null)
  new_code    uuid;     -- the code created from P
  has_content boolean;  -- does P have members / schedules / events of its own?
begin
  -- source member_group id (that became a container) -> new group_codes id
  create temp table if not exists _mg_code_map (mg_id uuid primary key, code_id uuid) on commit drop;

  for o in
    select distinct org_id
    from member_groups
    where org_id is not null
      and not exists (select 1 from group_codes gc where gc.org_id = member_groups.org_id)
  loop
    delete from _mg_code_map;

    -- Every container (a group with ≥1 child), shallowest-first. Depth comes from
    -- a recursive walk of the org's tree; the query is evaluated once here, so the
    -- deletes we do inside the loop don't disturb iteration order.
    for p in
      with recursive tree as (
        select g.id, g.parent_id, 0 as depth
        from member_groups g
        where g.org_id = o.org_id and g.parent_id is null
        union all
        select g.id, g.parent_id, t.depth + 1
        from member_groups g
        join tree t on g.parent_id = t.id
      )
      select mg.id, mg.name, mg.color, mg.term_id, mg.sort_order, mg.parent_id, t.depth
      from member_groups mg
      join tree t on t.id = mg.id
      where mg.org_id = o.org_id
        and exists (select 1 from member_groups c where c.parent_id = mg.id)
      order by t.depth asc, mg.sort_order asc nulls last, mg.name asc
    loop
      -- Parent code = the code from P's parent (only set if that parent was itself
      -- a container we already processed).
      select code_id into code_parent from _mg_code_map where mg_id = p.parent_id;

      insert into group_codes (org_id, name, color, parent_id, term_id, sort_order)
      values (o.org_id, p.name, p.color, code_parent, p.term_id, coalesce(p.sort_order, 0))
      returning id into new_code;

      insert into _mg_code_map (mg_id, code_id) values (p.id, new_code);

      -- Every direct child of P now lives under the new code.
      update member_groups set code_id = new_code where parent_id = p.id;

      -- Pure container vs mixed node.
      has_content := exists (select 1 from member_group_memberships m where m.group_id = p.id)
                  or exists (select 1 from member_group_schedules s where s.group_id = p.id)
                  or exists (select 1 from events e where e.member_group_id = p.id);

      if has_content then
        -- Mixed node: keep P as a leaf group under its grandparent's code.
        update member_groups set code_id = code_parent where id = p.id;
      else
        -- Pure container: drop the group row (its identity carries on as the code).
        delete from member_groups where id = p.id;
      end if;
    end loop;

    -- Retire parent_id — code_id is the hierarchy now.
    update member_groups set parent_id = null where org_id = o.org_id;
  end loop;
end $$;
