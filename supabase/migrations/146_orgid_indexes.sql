-- Performance: add missing org_id indexes. Both tables are queried org-scoped in
-- several app sites (registration_forms: ~4, categories: ~7) but lacked a covering
-- index, so those reads were seq-scanning. Additive + safe.
create index if not exists idx_registration_forms_org_id on registration_forms(org_id);
create index if not exists idx_categories_org_id on categories(org_id);
