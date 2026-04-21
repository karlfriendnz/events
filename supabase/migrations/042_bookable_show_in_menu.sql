alter table bookables
  add column if not exists show_in_menu boolean not null default false;
