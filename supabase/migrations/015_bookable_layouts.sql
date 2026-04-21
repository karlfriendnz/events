-- Add layouts to bookables (array of layout names, e.g. ['Full Field','Thirds','Halfs','Quarters'])
alter table bookables add column if not exists layouts text[] default '{}';

-- Seed demo layouts on any bookable named like "Field 1" etc for testing
-- (no-op on production where real data exists)
