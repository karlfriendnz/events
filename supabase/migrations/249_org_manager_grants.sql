-- GOVERNING-BODY CLUB MANAGERS. A person at an NSO / Regional / Association / RST
-- (everything but CLUB) can be granted authority to act ACROSS the clubs beneath
-- their org — report on them, create events for them, message their members.
--
-- The ROLE is modelled as an ordinary access-granting person type on the governing
-- org (person_target_types.is_access). This table adds the missing CROSS-ORG SCOPE,
-- mirroring the migration-238 sport-access grant pattern (NULL = wildcard):
--
--   target_org_id NULL  → the person manages the WHOLE subtree of the governing org
--   target_org_id set   → an explicit club override (one row per assigned club)
--
--   capabilities text[] → what they may do across those clubs: 'report' | 'events' | 'comms'
create table if not exists org_manager_grants (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,  -- the governing org the grant is defined at
  person_id     uuid not null references persons(id) on delete cascade,        -- the manager (a persons row at the governing org)
  target_org_id uuid references organisations(id) on delete cascade,           -- NULL = whole subtree; a club id = explicit
  capabilities  text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists org_manager_grants_org_idx on org_manager_grants(org_id);
create index if not exists org_manager_grants_person_idx on org_manager_grants(person_id);
create index if not exists org_manager_grants_target_idx on org_manager_grants(target_org_id);
