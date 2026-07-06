-- A term set can be connected to a SPORT (org_sports): "the Seniors' halves"
-- belong to Swimming while the main school-term sequence belongs to Gymnastics.
-- Null = whole-club sequence. Groundwork for sport-scoped rollover nudges and
-- filtering; today it's set on /settings/memberships per set.
alter table term_sets add column if not exists sport_id uuid references org_sports(id) on delete set null;
