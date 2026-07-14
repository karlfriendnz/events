-- RSVP — the simplest form a member can fill in: "are you coming, yes or no".
--
-- The answer is NOT a form submission. It's the invitee's own status, which has
-- carried CONFIRMED / DECLINED since the first schema (001) and — until now —
-- was never written by anything: staff invites hardcoded INVITED, registrations
-- hardcoded CONFIRMED. A form is the OPT-IN layer for when you need to ask more
-- than yes/no; the yes/no itself lives here.
--
-- responded_at records WHEN they answered, so staff can tell "hasn't replied"
-- (null) apart from "replied, and said no" (set, status DECLINED) — the status
-- alone can't distinguish an untouched INVITED row from a considered one.
alter table invitees add column if not exists responded_at timestamptz;

-- The invitee list filters by "who hasn't replied yet", so index the answered set.
create index if not exists idx_invitees_event_responded on invitees (event_id, responded_at);
