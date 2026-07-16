-- Event-level age restriction (min/max), captured by the programme wizard and used
-- to show the "Invitee Restrictions" line + validate a registrant's age at signup.
alter table events add column if not exists age_min integer;
alter table events add column if not exists age_max integer;
