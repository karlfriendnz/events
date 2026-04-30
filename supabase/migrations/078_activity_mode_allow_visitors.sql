alter table activity_modes
  add column if not exists allow_visitors boolean not null default false;
