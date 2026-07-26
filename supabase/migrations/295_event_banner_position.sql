-- Postgres mirror of server/db/migrations/0021_event_banner_position.sql.
-- CSS object-position for the event banner ("50% 30%"); null = centre.

alter table events add column if not exists banner_position text;
