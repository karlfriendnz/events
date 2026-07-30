-- Mirror of server/db/migrations/0025_person_legacy_id.sql (the operative one —
-- people live in the MySQL/TiDB seam). Kept in step so Postgres doesn't drift.
--
-- The old platform's Person matching one of ours. An invoice over there requires a
-- personID, so anyone who registers must exist over there before they can be
-- invoiced; this remembers who they turned out to be rather than looking them up
-- (or re-creating them) on every save.
alter table persons add column if not exists legacy_person_id integer;
create index if not exists idx_persons_legacy_person_id on persons (legacy_person_id);
