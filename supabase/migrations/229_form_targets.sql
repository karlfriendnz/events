-- 228: Registration form connections — a form can connect to 1+ targets.
--
-- A form is first-class: build it once, connect it to whatever it registers
-- people into ("Term 3 enrolment" → 4 classes). The public page /r/form/:id
-- renders the form with a "Choose your class" block sourced from its group
-- targets; submit enrols each registrant into the class(es) they picked
-- (falling to the waitlist when a class is full).
--
-- target_type is open ('group' today; 'event' etc. later) so the same edge
-- covers future contexts without another migration.
create table if not exists registration_form_targets (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  form_id     uuid not null references registration_forms(id) on delete cascade,
  target_type text not null default 'group',
  target_id   uuid not null,
  sort_order  int  not null default 0,
  created_at  timestamptz default now(),
  unique(form_id, target_type, target_id)
);
create index if not exists registration_form_targets_form_idx on registration_form_targets(form_id);
create index if not exists registration_form_targets_target_idx on registration_form_targets(target_type, target_id);
