-- 174_comms_preferences.sql — per-relationship comms choice.
-- A guardian who receives a dependent's communications can choose WHICH
-- categories they get on that person's behalf. One row per (recipient, subject)
-- pair; absence of a row = receives everything (the default).
--   person_id          = the recipient (e.g. the guardian)
--   subject_person_id  = whose comms these are (e.g. the dependent)
--   categories         = the comm categories the recipient opts into
create table if not exists public.comms_preferences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  person_id uuid not null references public.persons(id) on delete cascade,
  subject_person_id uuid not null references public.persons(id) on delete cascade,
  categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (person_id, subject_person_id)
);

create index if not exists comms_preferences_person_idx on public.comms_preferences (person_id);
create index if not exists comms_preferences_org_idx on public.comms_preferences (org_id);
