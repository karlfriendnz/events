-- Two booking entry experiences per activity:
--  • 'wizard'    — the guided 7-step BookingWizard (existing default)
--  • 'scheduler' — a 3-step flow (venue → scheduler grid + mode → details)
--    that's faster for venues with sub-resources (courts/lanes/etc).

alter table activities
  add column if not exists booking_flow text not null default 'wizard'
    check (booking_flow in ('wizard', 'scheduler'));
