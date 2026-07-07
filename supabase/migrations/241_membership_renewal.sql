-- MEMBERSHIP RENEWAL SETTINGS (memberships-only feature, gated by kind).
-- One jsonb blob (renewal) on the membership group — shape owned by
-- useMemberships.DEFAULT_RENEWAL: member renewability + expiry reminder,
-- change/renew windows before+after expiry, invoice due mode, auto-renewal
-- flags (enabled/reminders/default-on/opt-in/opt-out/require-card), timing
-- (days before expiry) and payment strategy. Null = the defaults.
-- Settings are CAPTURED now; the renewal engine (cron + emails + collection)
-- consumes them in a later phase.
alter table member_groups add column if not exists renewal jsonb;
