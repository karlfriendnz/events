-- PROTOTYPE (/proto/*) — entities as first-class records + their people roster,
-- plus the two type-config facets the model needs: a permissions grid on a
-- PERSON type, and a member-slot roster definition on an ENTITY type.
-- Additive only; nothing existing reads these yet.

-- Entity records (a Team, a Business, a School, …). type_key = a
-- person_target_types.key where kind='entity'.
create table if not exists entities (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  type_key     text not null,
  name         text not null,
  custom_fields jsonb not null default '{}'::jsonb,
  status       text not null default 'active',
  created_at   timestamptz not null default now()
);
create index if not exists entities_org_idx on entities (org_id, type_key);

-- The people attached to an entity (the roster). The edge carries roles[].
create table if not exists entity_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  entity_id  uuid not null references entities(id) on delete cascade,
  person_id  uuid not null references persons(id) on delete cascade,
  roles      text[] not null default '{}'::text[],
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (entity_id, person_id)
);
create index if not exists entity_members_entity_idx on entity_members (entity_id);
create index if not exists entity_members_person_idx on entity_members (person_id);

-- Type facets. A PERSON type can carry a permissions grid (the access tab); an
-- ENTITY type can carry a member-slot roster definition (the members tab).
alter table person_target_types add column if not exists permissions  jsonb not null default '{}'::jsonb;
alter table person_target_types add column if not exists member_slots jsonb not null default '[]'::jsonb;
