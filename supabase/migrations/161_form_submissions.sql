-- ============================================================
-- 161_form_submissions.sql
-- Generic, context-agnostic store for every registration_forms submission.
-- The SAME form (registration_forms.config) is reused across the platform —
-- event registrations, group registrations, competition entries, website
-- enquiries, etc. Every submission, wherever it comes from, lands here as one
-- row keyed by (context_type, context_id). Context-specific side effects
-- (creating persons / invitees / registrations / memberships) are materialised
-- by the submit endpoint; this table is the uniform record of truth.
-- ============================================================

create table if not exists form_submissions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organisations(id) on delete cascade,
  form_id         uuid references registration_forms(id) on delete set null,
  -- What the submission was FOR. context_id is nullable so contextless
  -- submissions (e.g. a website enquiry not tied to any entity) are allowed.
  context_type    text not null,            -- 'event' | 'group' | 'competition' | 'enquiry' | ...
  context_id      uuid,
  status          text not null default 'SUBMITTED' check (status in (
                    'SUBMITTED', 'CONFIRMED', 'PENDING', 'CANCELLED'
                  )),
  -- The person who submitted (the primary registrant / enquirer).
  submitter_name  text,
  submitter_email text,
  submitter_phone text,
  -- The full normalised payload the renderer produced: every subject, every
  -- instance, every field answer, session selections, payment choice, totals.
  answers         jsonb not null default '{}',
  total_amount    numeric(10,2) not null default 0,
  discount_total  numeric(10,2) not null default 0,
  -- Optional links to whatever the context handler materialised.
  registration_id uuid references registrations(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists form_submissions_org_id_idx on form_submissions(org_id);
create index if not exists form_submissions_context_idx on form_submissions(context_type, context_id);
create index if not exists form_submissions_form_id_idx on form_submissions(form_id);

-- ------------------------------------------------------------
-- Fix a latent schema gap: registrations.checked_in_at is read + written in
-- pages/events/[id].vue (ticket order check-in + reporting) but was never added.
-- ------------------------------------------------------------
alter table registrations add column if not exists checked_in_at timestamptz;
