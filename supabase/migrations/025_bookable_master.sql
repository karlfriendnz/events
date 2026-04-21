alter table bookables add column if not exists master_id uuid references bookables(id) on delete set null;
create index if not exists bookables_master_idx on bookables(master_id);
