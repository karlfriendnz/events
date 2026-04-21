-- Layout capacity fractions: how much of the parent resource each layout occupies
-- and which granularity group it belongs to (prevents mixing incompatible splits)
--
-- Example — Basketball Court layouts:
--   Full Court  → capacity_fraction 1.0,  granularity 'FULL'
--   Half Court  → capacity_fraction 0.5,  granularity 'HALF'
--   Third Court → capacity_fraction 0.333, granularity 'THIRD'
--   Quarter Court → capacity_fraction 0.25, granularity 'QUARTER'
--
-- Availability rule (enforced in application layer):
--   1. All concurrent bookings on the same bookable must share the same granularity
--   2. Sum of booked fractions + new fraction must not exceed 1.0

alter table bookable_layouts
  add column if not exists capacity_fraction numeric(8,4) not null default 1.0,
  add column if not exists granularity       text         not null default 'FULL';
