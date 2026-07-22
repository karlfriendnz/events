-- Event visibility (Postgres parity of drizzle 0013). Who can see this event:
-- visibility 'public' | 'internal' | 'all_members' | 'custom' (null = internal). For
-- 'custom', the jsonb arrays name the extra audience (people type / person / group).
-- Additive; captured only.
alter table events add column if not exists visibility varchar(20);
alter table events add column if not exists visibility_type_keys jsonb;
alter table events add column if not exists visibility_person_ids jsonb;
alter table events add column if not exists visibility_group_ids jsonb;
