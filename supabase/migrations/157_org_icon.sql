-- ============================================================
-- 157_org_icon.sql
-- Clubs can upload both a wordmark logo and a square icon (app/favicon-style).
-- logo_url already exists (migration 001); add icon_url alongside it.
-- ============================================================

alter table organisations
  add column if not exists icon_url text;
