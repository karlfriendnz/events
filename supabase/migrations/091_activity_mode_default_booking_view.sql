-- Mode-level calendar view for the booking wizard.
-- When set, takes precedence over bookables.default_booking_view.
alter table activity_modes
  add column if not exists default_booking_view text;
