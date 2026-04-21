-- Persist session-level invitee config and eligibility restrictions
alter table sessions
  add column if not exists invitee_modes  text[]  default '{"all_members"}',
  add column if not exists invitee_groups text[]  default '{}',
  add column if not exists eligibility    jsonb   default '{}';
