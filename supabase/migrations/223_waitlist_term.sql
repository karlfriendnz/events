-- Tie a waitlist to a term, and give it a stable lineage so it survives term
-- rollover (mirrors member_groups.term_id / lineage_id). On rollover, the source
-- term's waitlists are cloned into the target term under the SAME lineage_id,
-- reconnected to the rolled-over groups, carrying the people still waiting.
alter table waitlists add column if not exists term_id    uuid references org_terms(id) on delete set null;
alter table waitlists add column if not exists lineage_id uuid;
update waitlists set lineage_id = id where lineage_id is null;
alter table waitlists add column if not exists rolled_from_id uuid;
create index if not exists waitlists_term_idx on waitlists(term_id);
