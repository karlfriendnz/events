-- Who holds each staff role on a code. Keyed by code LINEAGE (survives rename +
-- rollover) and a role slug; cascades to the code's sub-codes + groups.
create table if not exists code_staff (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  code_lineage_id uuid not null,
  person_id       uuid not null references persons(id) on delete cascade,
  role_key        text not null,
  created_at      timestamptz default now(),
  unique (code_lineage_id, person_id, role_key)
);
create index if not exists code_staff_org_idx     on code_staff(org_id);
create index if not exists code_staff_lineage_idx on code_staff(code_lineage_id);
create index if not exists code_staff_person_idx  on code_staff(person_id);
