-- TERM SETS: independent sequences of terms (the old platform's "term sets").
-- Term 1 → 2 → 3 → 4 is one set; "Seniors" running two half-year blocks is a
-- separate, unconnected set. "The next term" (rollover targets, the dashboard
-- nudge, wizard defaults) only ever resolves WITHIN a term's own set.
-- org_terms.set_id NULL = the club's default/main sequence.
create table if not exists term_sets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists term_sets_org_idx on term_sets(org_id);

alter table org_terms add column if not exists set_id uuid references term_sets(id) on delete set null;
create index if not exists org_terms_set_idx on org_terms(set_id);
