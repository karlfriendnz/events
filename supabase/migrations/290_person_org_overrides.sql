-- Supabase mirror of drizzle 0016 (the MySQL seam is the operative one for people).
-- A governing body's PRIVATE overlay of edits on a club-owned person: the NSO edits
-- an affiliated club's member, the edits live here keyed by (org_id = NSO, person_id)
-- and never touch the club's persons row until the NSO pushes them.
create table if not exists person_org_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  person_id uuid not null,
  core jsonb,
  custom_fields jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, person_id)
);
create index if not exists person_org_overrides_person_idx on person_org_overrides(person_id);
