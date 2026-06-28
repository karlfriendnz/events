-- person_notes.links — connect a note to other parts of the system.
-- Array of { type: 'event'|'group'|'booking'|…, id: uuid, label: text }.
-- Replaces the old free-text tags as the way notes relate to entities.
alter table person_notes add column if not exists links jsonb not null default '[]';
