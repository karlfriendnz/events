-- ============================================================
-- Member group editable detail fields
-- The group detail page (/groups/:id) INFO card surfaced Code / Age Range /
-- Capacity / Current Term / Term Fee, but only name + color existed as real
-- columns (the rest were hardcoded placeholders). Add them so the group can be
-- edited end-to-end.
-- ============================================================
alter table member_groups add column if not exists code         text;
alter table member_groups add column if not exists age_range    text;
alter table member_groups add column if not exists capacity     integer;
alter table member_groups add column if not exists current_term text;
alter table member_groups add column if not exists term_fee      numeric(10,2);
