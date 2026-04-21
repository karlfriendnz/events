alter table bookables
  add column if not exists allow_multiple_layouts boolean not null default true;
