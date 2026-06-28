-- ============================================================
-- 166_field_definitions_meta.sql
-- Layout/builder extras for the per-person-type form builder (<PersonFormBuilder>):
-- col_span (Half/Full), placeholder, and block payloads (image/text/button) for
-- field_definitions rows whose field_type is a layout block (section/image/
-- text-block/button). Regular field props keep using existing columns
-- (key = system name, help_text = helper, options = dropdown options).
-- ============================================================

alter table field_definitions
  add column if not exists meta jsonb not null default '{}';
