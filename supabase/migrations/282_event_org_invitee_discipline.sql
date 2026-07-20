-- Optionally scope a club invite to ONE discipline. Null = the whole event (the
-- club is invited generally). SET NULL on discipline delete: a removed discipline
-- reverts the invite to whole-event rather than deleting the club's invitation.
alter table event_org_invitees
  add column if not exists discipline_id uuid references disciplines(id) on delete set null;
