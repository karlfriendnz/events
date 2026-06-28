-- Subject types (person_target_types) gain a `kind` so a registration form can
-- collect not only PEOPLE (child, parent, coach, emergency contact) but also
-- ENTITIES — a Team, Company, or School — each with its own field structure
-- (e.g. a Team has a name, colours, logo). Both flow down to clubs via the same
-- inheritance the field engine already uses. The min/max *limits* are NOT a
-- property of the type — they are declared per-form in the form builder.
alter table person_target_types
  add column if not exists kind text not null default 'person'
    check (kind in ('person', 'entity'));

comment on column person_target_types.kind is
  'person = a human registrant (child/parent/coach); entity = a Team/Company/School registrant with its own field structure.';
