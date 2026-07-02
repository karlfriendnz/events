-- Remove the demo ENTITY types (Class / Squad / Birthday party) from EVERY org
-- (clubs, regionals, NSOs) — not just the one demo club. They were seeded by
-- migration 189 and duplicated the live member_groups model. Targets the three
-- known demo keys everywhere + everything they own. Idempotent.
do $$
declare
  v_keys text[] := array['class', 'squad', 'birthday_party'];
begin
  -- entity records + their rosters (entity_members cascades on entity delete)
  delete from entities where type_key = any(v_keys);
  -- custom fields defined for those entity types (own or via targets[])
  delete from field_definitions where (target = any(v_keys) or targets && v_keys);
  -- saved profile-form layouts for those types
  delete from profile_forms where type_key = any(v_keys);
  -- the entity type definitions themselves, in every org
  delete from person_target_types where kind = 'entity' and key = any(v_keys);
end $$;
