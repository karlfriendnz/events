-- How a booking made for this mode lands: confirmed instantly or pending review.
alter table activity_modes
  add column if not exists approval_mode text not null default 'INSTANT'
    check (approval_mode in ('INSTANT', 'REQUIRES_APPROVAL'));
