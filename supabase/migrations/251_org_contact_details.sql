-- ORGANISATION CONTACT DETAILS (Settings → General). Ported from the legacy
-- "Contact" tab: a short name, postal address + country, timezone, and the club's
-- public contact email / phone / website. All optional. `name` is the full name.
alter table organisations add column if not exists short_name text;
alter table organisations add column if not exists address    text;
alter table organisations add column if not exists country    text;
alter table organisations add column if not exists timezone   text;
alter table organisations add column if not exists email      text;
alter table organisations add column if not exists phone      text;
alter table organisations add column if not exists website    text;
