-- Multi-layout venues need each availability rule to optionally scope to a
-- specific layout (e.g. "competition-court layout open Mon-Fri 9-5"). NULL
-- means the rule applies regardless of the active layout.
alter table availability_rules
  add column if not exists layout_id uuid references bookable_layouts(id) on delete set null;

create index if not exists availability_rules_layout_idx
  on availability_rules(layout_id);
