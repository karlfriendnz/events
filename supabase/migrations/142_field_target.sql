-- ============================================================
-- 142_field_target.sql
-- Who a field captures data about, so forms can collect (and group) different
-- fields for the member/child vs a parent/guardian vs an emergency contact.
--   MEMBER   - the person being registered (e.g. the child/player)
--   GUARDIAN - parent / guardian
--   CONTACT  - emergency contact
-- ============================================================

alter table field_definitions add column if not exists target text not null default 'MEMBER';
