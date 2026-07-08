-- PERSON LOGIN status. Tracks whether a person has been sent a login invite and
-- when. The auth account itself lives in Supabase auth (matched by email); this
-- is just the club-side status for the profile "Access" panel.
alter table persons add column if not exists invited_at timestamptz;
