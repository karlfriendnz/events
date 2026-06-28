-- PROTOTYPE — platform-global profile (person) types. The baseline set every
-- club inherits, mirroring the core permission templates (org_id NULL + a flag).
-- Clubs see them locked and can Override (make an editable local copy) / Reset.
--   is_global  — a platform baseline type (org_id NULL)
--   is_access  — primarily a permission-bearing type (Committee/Manager/Admin)

alter table person_target_types add column if not exists is_global boolean not null default false;
alter table person_target_types add column if not exists is_access boolean not null default false;
-- global rows have no owning org
alter table person_target_types alter column org_id drop not null;

-- Seed the six globals (idempotent on key).
insert into person_target_types (org_id, key, label, kind, is_global, is_access, sort_order)
select null, v.key, v.label, 'person', true, v.is_access, v.sort_order
from (values
  ('member',            'Member',            false, 0),
  ('parent',            'Parent',            false, 1),
  ('emergency_contact', 'Emergency contact', false, 2),
  ('committee',         'Committee',         true,  3),
  ('manager',           'Manager',           true,  4),
  ('admin',             'Admin',             true,  5)
) as v(key, label, is_access, sort_order)
where not exists (
  select 1 from person_target_types g where g.is_global and g.key = v.key
);
