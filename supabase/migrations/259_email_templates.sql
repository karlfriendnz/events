-- Invitation emails — a basic, merge-field template the club can make its own.
--
-- SCOPE: the club's real mailer is the (upgraded) FriendlyManager one, so this is
-- deliberately the smallest thing that sends a decent email, with a clean seam to
-- extend. What we're modelling is the CONTENT (subject + body + merge fields),
-- not a mail platform: delivery lives in server/utils/email.ts, and templating is
-- keyed by name so a richer editor — or FM's — can grow into these same rows
-- rather than migrate off them.
--
-- Two levels, because that's how clubs actually work:
--   email_templates  → the club's DEFAULT wording, written once  (per org, per key)
--   events.invitation_email → THIS event's override, seeded from the default
-- An event with no override just uses the club default; a club with no default
-- uses DEFAULT_INVITATION in code. Nothing is ever un-sendable.
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  -- 'event_invitation' today. Reminders, confirmations, cancellations are the
  -- same shape, which is why this is a key and not a column.
  key text not null,
  subject text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (org_id, key)
);

create index if not exists idx_email_templates_org on email_templates (org_id);

-- The per-event override: { subject, body }. Null = use the club default.
alter table events add column if not exists invitation_email jsonb;

-- When each invitee was last actually SENT an invitation. Distinct from
-- invitees.invited_at (set when they were ADDED to the event, whether or not
-- anything was ever emailed) — without this you can't tell "invited but never
-- told" from "told, hasn't replied", and re-sending would spam the answered.
alter table invitees add column if not exists invite_sent_at timestamptz;
