-- Multiple categories per event. category_id stays the PRIMARY (category_ids[0]) for
-- back-compat with the many display sites that read a single category; category_ids
-- holds the full multi-select. Null = no categories.
alter table events add column if not exists category_ids jsonb;
