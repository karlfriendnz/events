-- Promote layouts from text[] to a proper table so each layout can have per-tier pricing
create table if not exists bookable_layouts (
  id          uuid primary key default gen_random_uuid(),
  bookable_id uuid not null references bookables(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  is_active   bool not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists bookable_layout_tiers (
  id               uuid primary key default gen_random_uuid(),
  layout_id        uuid not null references bookable_layouts(id) on delete cascade,
  pricing_tier_id  uuid not null references pricing_tiers(id) on delete cascade,
  price            numeric(10,2) not null default 0,
  price_type       text not null default 'FIXED'
                     check (price_type in ('FIXED','PER_HOUR','PER_PERSON','FREE')),
  unique (layout_id, pricing_tier_id)
);

create index if not exists bookable_layouts_bookable_idx on bookable_layouts(bookable_id);
create index if not exists bookable_layout_tiers_layout_idx on bookable_layout_tiers(layout_id);

-- Migrate existing text[] layouts into the new table
insert into bookable_layouts (bookable_id, name, sort_order)
select id, unnest(layouts), generate_series(0, array_length(layouts, 1) - 1)
from bookables
where layouts is not null and array_length(layouts, 1) > 0;
