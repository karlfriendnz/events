-- A group can have an image + an explicit Head (head coach) person.
-- image_url: uploaded via /api/upload, shown by the group's title + edit dialog.
-- head_person_id: the designated head; the INFO "Head" falls back to the first
-- coach when null.
alter table member_groups add column if not exists image_url      text;
alter table member_groups add column if not exists head_person_id uuid references persons(id) on delete set null;
