do $$
declare
  pool_id   uuid := gen_random_uuid();
  comp_id   uuid := gen_random_uuid();
  org_id    uuid := '00000000-0000-0000-0000-000000000002';
begin
  -- Swimming Pool (parent)
  insert into bookables (id, org_id, name, type, status, max_concurrent, allow_multiple_layouts)
  values (pool_id, org_id, 'Swimming Pool', 'VENUE', 'ACTIVE', 1, true);

  -- Competition Pool (child of Swimming Pool)
  insert into bookables (id, org_id, name, type, status, max_concurrent, parent_id, allow_multiple_layouts)
  values (comp_id, org_id, 'Competition Pool', 'VENUE', 'ACTIVE', 4, pool_id, true);

  -- 4 Lanes (children of Competition Pool)
  insert into bookables (id, org_id, name, type, status, max_concurrent, parent_id, allow_multiple_layouts)
  values
    (gen_random_uuid(), org_id, 'Lane 1', 'VENUE', 'ACTIVE', 1, comp_id, false),
    (gen_random_uuid(), org_id, 'Lane 2', 'VENUE', 'ACTIVE', 1, comp_id, false),
    (gen_random_uuid(), org_id, 'Lane 3', 'VENUE', 'ACTIVE', 1, comp_id, false),
    (gen_random_uuid(), org_id, 'Lane 4', 'VENUE', 'ACTIVE', 1, comp_id, false);
end $$;
