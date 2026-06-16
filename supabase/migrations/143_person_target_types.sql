-- ============================================================
-- 143_person_target_types.sql
-- Configurable "person types" a form/registration can capture data about —
-- Member, Parent/Guardian, Emergency Contact, plus roles like Coach, Volunteer,
-- Medical, Team Manager, etc. Each carries a min/max count (how many of that
-- person must / may be captured). Org-owned and inherited down the hierarchy
-- (so an NSO can mandate types), like field_definitions. fields reference a type
-- via field_definitions.target (the type key).
-- ============================================================

create table if not exists person_target_types (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  key         text not null,            -- slug referenced by field_definitions.target
  label       text not null,
  min_count   int not null default 0,
  max_count   int,                       -- null = unlimited
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (org_id, key)
);
create index if not exists person_target_types_org_idx on person_target_types(org_id);
