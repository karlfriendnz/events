-- Org-level default booking form. When set, activity modes without their own
-- form_id inherit this one; the booking wizard's Details step renders it.
alter table organisations
  add column if not exists default_form_id uuid references registration_forms(id) on delete set null;

create index if not exists organisations_default_form_id_idx on organisations(default_form_id);
