-- Per-mode equipment pricing.
--
-- An item bookable is just an inventory record (PA System ×1, Cones
-- ×50). It has no built-in price — pricing only makes sense in the
-- context of how it's being hired. `price_override` lets the mode
-- editor say "PA System for a Birthday booking is $30 each", and that
-- flows through to the booking total.
--
-- Per-unit price (multiplied by quantity at booking time). Null = no
-- charge for this item on this mode (still reserved, just free).

alter table activity_mode_required_items
  add column if not exists price_override numeric(10, 2);
