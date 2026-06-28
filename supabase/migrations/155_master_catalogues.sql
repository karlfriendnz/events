-- ============================================================
-- 155_master_catalogues.sql
-- Super-admin "Master" catalogues, managed at /admin/master:
--   * brands           — a brand a club connects to (white-label / parent brand).
--                        Clubs reference one via organisations.brand_id.
--   * sport_categories — platform-wide grouping for sports.
-- (club_types already exists from migration 151 and is surfaced as a Master tab.)
-- All are platform-global (not org-scoped — super-admin owns them).
-- ============================================================

create table if not exists brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  logo_url   text,
  color      text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- A club can be connected to one brand.
alter table organisations
  add column if not exists brand_id uuid references brands(id) on delete set null;

create table if not exists sport_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
