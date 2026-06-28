-- Tag each person with a "people type" (Member / Guardian / Coach / …).
-- Stores the person_target_types.key (org-scoped, kind='person'); null = untyped.
-- Drives the type tabs on the /people directory.

alter table persons add column if not exists person_type text;
create index if not exists persons_person_type_idx on persons(person_type);
