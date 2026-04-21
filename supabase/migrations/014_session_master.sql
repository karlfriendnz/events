alter table sessions add column if not exists is_master boolean not null default false;
alter table sessions add column if not exists master_id uuid references sessions(id) on delete set null;

create index if not exists sessions_master_id_idx on sessions(master_id);
