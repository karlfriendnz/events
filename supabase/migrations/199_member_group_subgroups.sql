-- ============================================================
-- Member group sub-groups (mirrors the event attendance sub-group model)
-- Events store `events.sub_groups` jsonb + `invitees.sub_group_id`; member
-- groups get the same so the /groups/:id People tab can split members into
-- named sub-groups (e.g. squads, age bands, ability tiers).
-- ============================================================
alter table member_groups add column if not exists sub_groups jsonb not null default '[]'::jsonb;
-- Each sub_groups entry: { id (uuid text), name, color }

alter table member_group_memberships add column if not exists sub_group_id text;
-- Points at a member_groups.sub_groups[].id (free text id, not an FK).
