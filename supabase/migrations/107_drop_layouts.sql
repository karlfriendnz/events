-- Layouts have been folded into modes (activity_modes carries pricing,
-- capacity, addons, payment options). Drop the layouts surface entirely:
-- columns on related tables, then the tables themselves in dependency order.

-- Columns referencing layouts
alter table bookings drop column if exists layout_id;
alter table bookings drop column if exists layout_name;
do $$
begin
  if to_regclass('public.booking_quotes') is not null then
    execute 'alter table booking_quotes drop column if exists layout_id';
  end if;
end $$;

-- Bookable-level flags
alter table bookables drop column if exists allow_multiple_layouts;
alter table bookables drop column if exists layouts;

-- Tables (dependants first)
drop table if exists booking_window_layout_prices cascade;
drop table if exists bookable_layout_modes        cascade;
drop table if exists bookable_layout_configs      cascade;
drop table if exists bookable_layouts             cascade;
