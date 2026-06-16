-- ============================================================
-- 139_org_member_fields.sql
-- Field engine (built on the existing FormBuilder / registration_forms):
-- each org can own a "member fields" form. A club's effective member fields =
-- the merge of its ancestors' member-fields forms (inherited, e.g. NSO-required)
-- plus its own. Resolved via org_ancestors() (composables/useOrgFieldPolicy.ts).
-- ============================================================

alter table organisations
  add column if not exists member_form_id uuid references registration_forms(id) on delete set null;

create index if not exists organisations_member_form_idx on organisations(member_form_id);
