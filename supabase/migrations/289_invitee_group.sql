-- Parity with drizzle 0015. The group a person was invited THROUGH (null = individual).
alter table invitees add column if not exists invited_via_group_id uuid;
