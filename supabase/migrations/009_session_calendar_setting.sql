-- Add show_as_separate_event flag to sessions
alter table sessions
  add column if not exists show_as_separate_event boolean not null default false;
