-- 175_contacts.sql — "Family" reframed as person-centric Contacts.
-- A contact (e.g. "Amelia, mum of Jordan, primary contact") is a member of the
-- viewed person's family circle. These columns describe that relationship:
--   relationship   = free-text label of how they relate ("Mum", "Dad", "Guardian"…)
--   is_primary     = the primary contact for the person (one per person)
--   receives_comms = whether they receive communications on the person's behalf
-- Circles (kind='circle') keep their grouping (name/colour/image); contacts don't.
alter table public.circle_members
  add column if not exists relationship text,
  add column if not exists is_primary boolean not null default false,
  add column if not exists receives_comms boolean not null default false;
