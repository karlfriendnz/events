-- ============================================================
-- Group Codes — hierarchical containers for member groups.
--
-- A CODE is a container that holds member groups and carries properties the
-- groups inside it INHERIT. Codes REPLACE the old member_groups.parent_id
-- nesting: a group belongs to exactly one Code (member_groups.code_id), and
-- Codes themselves nest (group_codes.parent_id).
--
-- For now the only inherited property is TERM (term_id → org_terms). The table
-- is shaped so more inheritable properties can be added later as columns
-- (colour is already carried); useGroupCodes().effectiveTermId walks the code
-- parent chain, so a child code with a null term inherits its parent's.
--
-- term_id NULL on a code = "no term" (shows under "All" in the group filter).
-- ============================================================

create table if not exists group_codes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  color text,
  parent_id uuid references group_codes(id) on delete set null,
  term_id uuid references org_terms(id) on delete set null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists group_codes_org_idx on group_codes(org_id);
create index if not exists group_codes_parent_idx on group_codes(parent_id);

alter table member_groups add column if not exists code_id uuid references group_codes(id) on delete set null;
create index if not exists member_groups_code_idx on member_groups(code_id);
