-- ============================================================
-- 153_reset_club_permission_groups.sql
-- One-off reset: remove ALL club-level permission groups (both core overrides
-- and custom local groups) across every org, so every club falls back to the
-- 6 inherited core templates seeded in migration 152. Member assignments on
-- those groups cascade away via permission_group_members FK (on delete cascade).
-- Core templates (is_core=true / org_id=null) are untouched.
-- Idempotent: re-running deletes nothing once clubs have no local groups.
-- ============================================================

delete from permission_groups where org_id is not null;
