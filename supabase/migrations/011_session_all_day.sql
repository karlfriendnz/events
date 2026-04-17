alter table sessions
  add column if not exists is_all_day boolean not null default false;
