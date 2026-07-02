-- Notes can be shown to MULTIPLE audiences. visible_to is an array of tokens:
--   { type:'staff'|'admin'|'member'|'parents'|'circle' } for groups, or
--   { type:'person', id:<persons.id>, label } for a specific parent/contact.
-- (supersedes the single `visibility` text from migration 210, kept for back-compat)
alter table person_notes add column if not exists visible_to jsonb not null default '[]';
