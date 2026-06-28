-- 176_contact_type.sql — a contact has a TYPE (classification), separate from
-- their relationship label. One of: primary | standard | emergency | contact.
-- Supersedes the is_primary boolean (kept in sync: is_primary = type='primary').
alter table public.circle_members
  add column if not exists contact_type text;

-- Backfill from the existing primary flag.
update public.circle_members
  set contact_type = case when is_primary then 'primary' else 'standard' end
  where contact_type is null and relationship is not null;
