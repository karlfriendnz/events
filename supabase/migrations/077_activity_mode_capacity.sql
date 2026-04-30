alter table activity_modes
  add column if not exists min_people    integer,   -- null = no minimum
  add column if not exists max_people    integer,   -- null = no maximum
  add column if not exists min_visitors  integer,   -- null = no minimum
  add column if not exists max_visitors  integer;   -- null = no maximum
