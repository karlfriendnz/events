-- Mirror of server/db/migrations/0024_event_legacy_id.sql (the operative one —
-- events live in the MySQL/TiDB seam). Kept in step so Postgres doesn't drift.
--
-- The old platform's Event row that mirrors one of this module's events, so a club
-- running embedded keeps ONE calendar. Also what makes registering an event
-- idempotent: the old API creates without an id and updates with one, so a re-save
-- must send this back or the club gets a duplicate event.
alter table events add column if not exists legacy_event_id integer;
create index if not exists idx_events_legacy_event_id on events (legacy_event_id);
