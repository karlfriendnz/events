alter table activities
  add column if not exists approval_mode            text    not null default 'auto'
                                                    check (approval_mode in ('auto', 'manual')),
  add column if not exists booking_window_days      integer,   -- null = unlimited (how far ahead)
  add column if not exists min_notice_hours         integer,   -- null = no minimum (must book X hrs before)
  add column if not exists cancellation_window_hours integer,  -- null = anytime
  add column if not exists min_duration_mins        integer,   -- null = no minimum
  add column if not exists max_duration_mins        integer,   -- null = no maximum
  add column if not exists buffer_mins              integer;   -- null = no buffer between bookings
