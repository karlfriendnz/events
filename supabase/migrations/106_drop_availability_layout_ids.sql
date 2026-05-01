-- Layouts are being folded into modes — availability rules already scope via
-- activity_mode_ids, which covers every use case the layout array did. Drop
-- the layout_ids column to avoid two parallel scoping mechanisms.
drop index if exists availability_rules_layout_ids_idx;
alter table availability_rules drop column if exists layout_ids;
