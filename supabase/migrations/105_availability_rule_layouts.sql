-- Switch from single layout_id to a layout_ids array — a rule can now apply
-- to multiple layouts (empty = any). Migrate any existing single value into
-- the array, then drop the old column + index.
alter table availability_rules
  add column if not exists layout_ids uuid[] not null default '{}';

update availability_rules
  set layout_ids = array[layout_id]
  where layout_id is not null and layout_ids = '{}';

drop index if exists availability_rules_layout_idx;
alter table availability_rules drop column if exists layout_id;

create index if not exists availability_rules_layout_ids_idx
  on availability_rules using gin (layout_ids);
