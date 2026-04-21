-- Move booking_types, pricing_tiers, booking_addons to per-bookable
alter table booking_types  add column if not exists bookable_id uuid references bookables(id) on delete cascade;
alter table pricing_tiers  add column if not exists bookable_id uuid references bookables(id) on delete cascade;
alter table booking_addons add column if not exists bookable_id uuid references bookables(id) on delete cascade;

create index if not exists booking_types_bookable_idx  on booking_types(bookable_id);
create index if not exists pricing_tiers_bookable_idx  on pricing_tiers(bookable_id);
create index if not exists booking_addons_bookable_idx on booking_addons(bookable_id);
