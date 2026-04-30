-- RESTRICTED availability rules can scope access by criteria (conditions) and/or
-- by member-group invitee list — same shape as sessions for consistency.
alter table availability_rules
  add column if not exists invitee_modes  text[] default '{"all_members"}',
  add column if not exists invitee_groups text[] default '{}',
  add column if not exists eligibility    jsonb  default '{}'::jsonb;
