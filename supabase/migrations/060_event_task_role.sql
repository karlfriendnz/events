alter table event_tasks add column if not exists is_role         boolean not null default false;
alter table event_tasks add column if not exists role_capacity   int     not null default 1;
