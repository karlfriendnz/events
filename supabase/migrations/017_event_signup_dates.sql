alter table events add column if not exists reg_open_at  timestamptz;
alter table events add column if not exists reg_close_at timestamptz;
