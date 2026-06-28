-- ============================================================
-- 158_brand_icon.sql
-- Brands can have a square icon (app/favicon-style mark) in addition to the
-- existing logo_url (wordmark). Uploaded from /admin/master Brands tab.
-- ============================================================

alter table brands
  add column if not exists icon_url text;
