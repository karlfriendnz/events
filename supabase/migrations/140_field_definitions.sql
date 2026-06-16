-- ============================================================
-- 140_field_definitions.sql
-- Field engine, proper: fields are FIRST-CLASS, created separately (not inside
-- a form). Each field definition is owned by an org; a club inherits its
-- governing bodies' field definitions (e.g. NSO-required) plus its own. Forms
-- (and registration) compose these — the FormBuilder can pull from the library.
-- ============================================================

create table if not exists field_definitions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  label       text not null,
  key         text,                                  -- storage slug (optional)
  field_type  text not null default 'SHORT_TEXT',    -- reuses form_fields type values
  options     jsonb default '[]',                    -- for SINGLE_SELECT / MULTI_SELECT
  is_required boolean not null default true,
  help_text   text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists field_definitions_org_idx on field_definitions(org_id);
