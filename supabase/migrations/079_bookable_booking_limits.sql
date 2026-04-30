alter table bookables
  add column if not exists booking_limit_type  text    not null default 'none'
                                               check (booking_limit_type in ('none','per_time_range','per_day','per_week','per_month')),
  add column if not exists booking_limit_count integer,          -- null = no specific count set
  add column if not exists disallow_concurrent  boolean not null default false,
  add column if not exists disallow_consecutive boolean not null default false,
  add column if not exists allow_modes_with_others boolean not null default false;
