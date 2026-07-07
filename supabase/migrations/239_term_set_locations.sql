-- TERM SETS × LOCATIONS. A term sequence can be scoped to one or MORE of the
-- club's locations (e.g. HBC + Albany share Term 3/4 while Orewa runs its own
-- half-year structure). null / empty = the whole club. Complements the sport
-- scope (235) — a set can carry either, both, or neither.
alter table term_sets add column if not exists location_ids uuid[];
