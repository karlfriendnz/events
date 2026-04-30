alter table bookables
  add column if not exists allow_sub_venues boolean not null default false;
