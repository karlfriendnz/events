-- What an invited club chose to connect from an event (event details/required fields,
-- fees, communication), + when it accepted/declined. Null connections = not chosen yet.
alter table event_org_invitees add column if not exists connections jsonb;
alter table event_org_invitees add column if not exists decided_at timestamptz;
