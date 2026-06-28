-- Per-coach pricing override on shared modes.
--
-- The `activity_mode_bookables` join already pins which bookables a mode
-- applies to. Adding `price_override` lets each coach (or any specific
-- bookable) charge a different rate for the same shared mode without
-- forking the mode itself. NULL = use the mode's own price.

alter table activity_mode_bookables
  add column if not exists price_override numeric(10, 2);
