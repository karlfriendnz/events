-- Phase 1: rentable-item bookings (lockers, projectors, etc.)
--
-- Reuses bookables/activities/activity_modes/bookings; adds the metadata
-- needed to express "rent for N days/weeks/months" instead of "book a
-- 30-min slot." Phase 2 will add renewal cron + cancellation flow for
-- recurring rentals; for now `is_recurring=true` rows live as open-ended
-- bookings with end_at = current period end.

-- 1. New booking flow value alongside 'wizard' + 'scheduler'
alter table activities
  drop constraint if exists activities_booking_flow_check;
alter table activities
  add  constraint activities_booking_flow_check
  check (booking_flow in ('wizard', 'scheduler', 'item'));

-- 2. Per-activity rule for who picks the specific resource:
--    'system'  → always auto-assign first available unit
--    'member'  → user must pick a specific unit
--    'either'  → booker shows "Assign me one" + the explicit list
alter table activities
  add column if not exists assignment_mode text not null default 'either'
    check (assignment_mode in ('system', 'member', 'either'));

-- 3. Mode-level rental period metadata. period_unit being NULL means this
--    mode is not an item-style rental and falls back to the existing
--    min/max_duration_mins behaviour.
alter table activity_modes
  add column if not exists period_unit text
    check (period_unit in ('hour', 'day', 'week', 'month', 'year'));
alter table activity_modes
  add column if not exists period_count int not null default 1
    check (period_count > 0);
alter table activity_modes
  add column if not exists term_type text not null default 'fixed'
    check (term_type in ('fixed', 'recurring'));

-- 4. Single-rate price for item modes. The existing `pricing` jsonb is
--    section/tier/fee-line based and overkill for "$10/week" — keep it
--    null on item modes and use period_price instead. Wizard/scheduler
--    activities stay on pricing jsonb.
alter table activity_modes
  add column if not exists period_price numeric(10, 2);

-- 5. Mark recurring rentals so the booking calendar + (eventual) renewal
--    cron can find them.
alter table bookings
  add column if not exists is_recurring boolean not null default false;
