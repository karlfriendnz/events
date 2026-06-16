-- ============================================================
-- 138_discipline_hierarchy.sql
-- Disciplines form a hierarchy within their owning NSO, e.g.
--   Seniors > Premiers > B Grade. Self-referential parent_id.
-- ============================================================

alter table disciplines add column if not exists parent_id uuid references disciplines(id) on delete set null;
create index if not exists disciplines_parent_idx on disciplines(parent_id);
