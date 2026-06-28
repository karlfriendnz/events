-- Club-configurable member profile dashboard.
-- organisations.profile_dashboard — the club's widget layout (CfgItem[] jsonb),
--   arranged once in Settings against a demo person, rendered on every member
--   profile's Dashboard tab. Nullable = use code defaults (reconciled on load).
-- persons.photo_url — member avatar (uploaded via /api/upload).
-- person_notes — the right-rail Notes feed (body + tags + author + date).

alter table organisations add column if not exists profile_dashboard jsonb;
alter table persons        add column if not exists photo_url text;

create table if not exists person_notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  person_id   uuid not null references persons(id) on delete cascade,
  body        text not null,
  tags        text[] not null default '{}',
  author_id   uuid,
  author_name text,
  created_at  timestamptz not null default now()
);
create index if not exists person_notes_person_id_idx on person_notes(person_id);
create index if not exists person_notes_org_id_idx on person_notes(org_id);
