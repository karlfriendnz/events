-- Bookable master/linked role system (mirrors sessions pattern)
-- is_master: true = this bookable is a template others can link to
-- master_id: (already exists) points to the master bookable
-- customized_sections: which sections have local overrides on a linked venue
--   empty array = all sections inherited from master
--   e.g. '{layouts}' = layouts are customised locally, everything else inherited
alter table bookables
  add column if not exists is_master           bool    not null default false,
  add column if not exists customized_sections text[]  not null default '{}';

-- Index for fast "give me all venues linked to this master" queries
create index if not exists bookables_master_id_idx on bookables(master_id) where master_id is not null;
