-- Categories may link to ONE OR MORE governing-body disciplines. discipline_ids = jsonb
-- array of disciplines.id; default_discipline_id stays the PRIMARY (discipline_ids[0])
-- for back-compat with everything that reads a single one. Additive; null = fall back to
-- default_discipline_id.
alter table categories add column if not exists discipline_ids jsonb;
