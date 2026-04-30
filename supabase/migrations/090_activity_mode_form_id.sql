-- Reusable per-mode question forms. Points at the existing registration_forms
-- registry so the same form can be attached to multiple modes (and to events).
alter table activity_modes add column if not exists form_id uuid references registration_forms(id) on delete set null;

create index if not exists activity_modes_form_id_idx on activity_modes(form_id);
