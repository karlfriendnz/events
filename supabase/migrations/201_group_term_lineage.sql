-- ============================================================
-- Group ⇄ term lineage (term rollover, clone-per-term)
--
-- A member_group now belongs to ONE term (term_id). At term end the row
-- freezes as history (derived: org_terms.end_date < today). The rollover
-- screen CLONES a term's groups into the next term — a new member_groups row
-- per source group, carrying schedules / plans / staff / members per the
-- user's per-group choice.
--
--   lineage_id           — stable identity across terms. "Step 2 Tuesday" is
--                          one lineage with a separate row per term.
--   rolled_from_group_id — provenance: the exact prior-term group this clone
--                          was rolled from.
--
-- term_id NULL = a legacy / evergreen group (e.g. existing demo groups that
-- predate terms) — these always show regardless of the term filter.
-- ============================================================

alter table member_groups add column if not exists term_id              uuid references org_terms(id) on delete set null;
alter table member_groups add column if not exists lineage_id           uuid;
alter table member_groups add column if not exists rolled_from_group_id uuid references member_groups(id) on delete set null;

-- every existing group is its own lineage root
update member_groups set lineage_id = id where lineage_id is null;

create index if not exists member_groups_term_idx    on member_groups(term_id);
create index if not exists member_groups_lineage_idx on member_groups(lineage_id);
