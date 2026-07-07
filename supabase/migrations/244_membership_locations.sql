-- A MEMBERSHIP can be connected to ONE OR MORE locations (classes keep their
-- single location_id — a class happens at a site; a membership is sold at
-- one, several, or all sites). Null / empty = the whole club, same convention
-- as term_sets.location_ids (239).
alter table member_groups add column if not exists location_ids uuid[];
