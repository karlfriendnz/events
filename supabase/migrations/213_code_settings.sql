-- Code settings: the member "user type" a code captures + a per-code staff role
-- catalogue with permissions.
--
-- member_type_key  = the person type of MEMBERS in groups under this code (drives
--                    which custom fields apply, etc).
-- lineage_id       = a code's stable identity across term rollovers (a code named
--                    "Blue" this term / "Red" next term is ONE lineage). Backfilled
--                    to id; carried on rollover so config follows the lineage.
alter table group_codes add column if not exists member_type_key text;
alter table group_codes add column if not exists lineage_id      uuid;
update group_codes set lineage_id = id where lineage_id is null;

-- Staff role catalogue. code_lineage_id null = an ORG-WIDE DEFAULT role (every
-- code gets it); otherwise the role belongs to that code lineage and CASCADES to
-- every sub-code + group inside it. A code's effective roles = defaults + the
-- roles of its own lineage and all ancestor code lineages.
create table if not exists code_role_defs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  code_lineage_id uuid,                       -- null = org-wide default
  key             text not null,              -- stable slug (survives rename)
  label           text not null,
  capabilities    text[] not null default '{}',
  sort_order      int default 0,
  created_at      timestamptz default now()
);
create index if not exists code_role_defs_org_idx     on code_role_defs(org_id);
create index if not exists code_role_defs_lineage_idx on code_role_defs(code_lineage_id);
