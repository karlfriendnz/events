-- Migration 101 attempted to add eligibility as jsonb but `add column if not exists`
-- was a no-op because 043 had already created it as text with a check constraint.
-- Convert to jsonb here, dropping the old constraint, so the AvailabilityEditor's
-- { restricted, conditions } payload (and the empty {} default) round-trip cleanly.

alter table availability_rules
  drop constraint if exists availability_rules_eligibility_check;

alter table availability_rules
  alter column eligibility drop default;

alter table availability_rules
  alter column eligibility type jsonb
  using case
    when eligibility is null then '{}'::jsonb
    when eligibility = 'anyone' then '{}'::jsonb
    else jsonb_build_object('legacy', eligibility)
  end;

alter table availability_rules
  alter column eligibility set default '{}'::jsonb;

alter table availability_rules
  alter column eligibility set not null;
