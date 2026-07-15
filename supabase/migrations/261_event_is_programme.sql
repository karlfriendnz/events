-- Programme = an event flagged is_programme. The /programme page is the SAME
-- events board as /events, scoped to these rows and locked to the List view;
-- /events excludes them. A programme still uses the whole event engine
-- (sessions, fees, forms, discounts) — it's just a category-like "set" flag.
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_programme boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS events_is_programme_idx ON events (org_id, is_programme);
