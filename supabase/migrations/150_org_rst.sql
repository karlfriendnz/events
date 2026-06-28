-- ============================================================
-- 150_org_rst.sql
-- New organisation type: RST (Regional Sports Trust) — a PARTNER org that
-- individuals connect to (e.g. coaches get upskilled through an RST). It is NOT
-- part of the club → regional → association → national governing chain, so it's
-- excluded from "governing body" lists in the app (affiliation, disciplines).
-- ============================================================

-- Allow 'RST' as an org_level (migration 134 added the original check).
alter table organisations drop constraint if exists organisations_org_level_check;
alter table organisations add constraint organisations_org_level_check
  check (org_level in ('CLUB', 'REGIONAL', 'ASSOCIATION', 'NATIONAL', 'RST'));

-- Allow 'RST' as a type (migration 001 limited it to NSO/CLUB). Kept distinct
-- from 'NSO' so RST orgs never show up where governing bodies are expected.
alter table organisations drop constraint if exists organisations_type_check;
alter table organisations add constraint organisations_type_check
  check (type in ('NSO', 'CLUB', 'RST'));
