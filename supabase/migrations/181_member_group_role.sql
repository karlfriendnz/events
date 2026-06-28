-- member_group_memberships.role — the person's role within that group
-- (e.g. Player, Captain, Coach, Manager). Free text; null = plain member.
alter table member_group_memberships add column if not exists role text;
