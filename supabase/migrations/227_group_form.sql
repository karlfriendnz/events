-- 227: Public class registration — a group can link ONE registration form.
--
-- Mirrors events.form_id: the public page /r/group/:id resolves the group's
-- linked form so a class has a shareable signup link with no query string.
-- Set from the "Public registration" dialog on /groups/:id.
alter table member_groups add column if not exists form_id uuid references registration_forms(id) on delete set null;
create index if not exists member_groups_form_idx on member_groups(form_id);
