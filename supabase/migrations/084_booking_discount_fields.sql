-- Record which discount (if any) was applied to a booking, and the amount.
alter table bookings
  add column if not exists booking_discount_id uuid references booking_discounts(id) on delete set null,
  add column if not exists discount_amount numeric(10, 2);

create index if not exists bookings_discount_idx on bookings(booking_discount_id);
