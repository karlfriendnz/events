-- The old platform's Event row that MIRRORS one of this module's events.
--
-- A club running embedded keeps one calendar, one set of member timelines and one
-- set of reports — all of them the old platform's. So an event created here is
-- registered over there too, and this is the id that comes back.
--
-- It is also what makes that registration IDEMPOTENT: the old API creates a row
-- when given no id and updates the row when given one, so saving an event twice
-- has to send the id back or the club gets two events. No separate idempotency
-- store, just this column.
--
-- Null = never registered (no legacy connection for this club, or that platform
-- was unreachable when the event was saved — which must never fail the save).
ALTER TABLE events ADD COLUMN legacy_event_id INT NULL;
CREATE INDEX idx_events_legacy_event_id ON events (legacy_event_id);
