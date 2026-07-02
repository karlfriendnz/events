-- Remove the NHG demo ENTITY types (Class / Squad / Birthday party) + everything
-- they own. They were seeded by migration 189 before the live member_groups model
-- existed, so classes/squads were modelled twice (as groups AND as entities) —
-- confusing clutter in /settings/fields and /organisations. Scoped to the demo
-- club by slug; idempotent.
do $$
declare
  v_org  uuid;
  v_keys text[];
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;

  select array_agg(key) into v_keys
    from person_target_types where org_id = v_org and kind = 'entity';
  if v_keys is null then return; end if;

  -- entity records + their rosters (entity_members cascades on entity delete)
  delete from entities where org_id = v_org and type_key = any(v_keys);
  -- custom fields defined for those entity types (own or via targets[])
  delete from field_definitions where org_id = v_org
    and (target = any(v_keys) or targets && v_keys);
  -- saved profile-form layouts for those types
  delete from profile_forms where org_id = v_org and type_key = any(v_keys);
  -- the entity type definitions themselves
  delete from person_target_types where org_id = v_org and kind = 'entity';
end $$;
