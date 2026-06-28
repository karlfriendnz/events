-- ============================================================
-- 168_profile_forms.sql
-- The FORM LAYOUT for a person type (profile). field_definitions is the field
-- LIBRARY (core/inherited/own, per target); this stores how a club lays those
-- fields out — order, sections, blocks, per-field visibility conditions — for
-- one person type. Keyed by (org_id, type_key) so it works for both the club's
-- own types and inherited (NSO) types. config jsonb = { fields: FormField[] }
-- (same FormField shape the events builder uses). Events that include this
-- subject type seed their form from this layout.
-- ============================================================

create table if not exists profile_forms (
  org_id     uuid not null references organisations(id) on delete cascade,
  type_key   text not null,
  config     jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (org_id, type_key)
);
