-- Allow events to hide the hero banner area entirely.
alter table events add column if not exists hide_banner boolean not null default false;
