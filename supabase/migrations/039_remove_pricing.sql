-- Drop dependent tables first
drop table if exists booking_quote_items cascade;
drop table if exists booking_quotes cascade;
drop table if exists booking_discount_rules cascade;
drop table if exists pricing_tier_restrictions cascade;
drop table if exists booking_window_tiers cascade;
drop table if exists bookable_layout_tiers cascade;
drop table if exists booking_addons cascade;
drop table if exists booking_types cascade;
drop table if exists pricing_tiers cascade;

-- Drop columns from bookings
alter table bookings
  drop column if exists booking_type_id,
  drop column if exists pricing_tier_id,
  drop column if exists selected_addon_ids,
  drop column if exists total_price,
  drop column if exists quote_id;
