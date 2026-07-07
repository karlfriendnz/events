-- CUSTOM REPORTS. Club-built people reports: a name + a filter/column config.
-- config jsonb = { filters: [{ field, op, value }], match: 'all'|'any', columns: [fieldKey] }
-- where `field` is a core column (gender/dob/membership_type/…), a role/type,
-- a member position, or a custom field (cf:<field_definition_id>). Ages derive
-- from dob at run time. Run + saved from /reports.
create table if not exists custom_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  config jsonb not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists custom_reports_org_idx on custom_reports(org_id);
