-- Note options: who can see it + whether it's flagged important.
-- visibility: staff (default) | admin | everyone | private (author only).
-- is_important: surfaced with a flag + highlight.
alter table person_notes add column if not exists visibility   text    not null default 'staff';
alter table person_notes add column if not exists is_important boolean not null default false;
