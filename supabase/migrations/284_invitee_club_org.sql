-- Which CLUB added this invitee. Null = the event owner's own invitee (a normal event).
-- Set to the club's org id when a club invites its OWN people to a SHARED event, so each
-- club sees only its own invitees on an event it doesn't own.
alter table invitees add column if not exists club_org_id uuid;
