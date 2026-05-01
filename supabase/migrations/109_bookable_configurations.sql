-- Configurations are named layouts of a parent venue (e.g. Tennis Court →
-- "Halves" or "Quarters"). They group existing sub-venues so a mode can ask
-- for "any half" rather than picking a specific Half A / Half B.
create table if not exists bookable_configurations (
  id                  uuid primary key default gen_random_uuid(),
  parent_bookable_id  uuid not null references bookables(id) on delete cascade,
  key                 text not null,           -- e.g. 'halves', 'quads'
  name                text not null,           -- e.g. 'Halves', 'Quarters'
  sort_order          int  not null default 0,
  created_at          timestamp not null default now(),
  unique (parent_bookable_id, key)
);
create index if not exists bookable_configurations_parent_idx
  on bookable_configurations(parent_bookable_id);

create table if not exists bookable_configuration_children (
  configuration_id  uuid not null references bookable_configurations(id) on delete cascade,
  bookable_id       uuid not null references bookables(id)              on delete cascade,
  sort_order        int  not null default 0,
  primary key (configuration_id, bookable_id)
);
create index if not exists bookable_configuration_children_bookable_idx
  on bookable_configuration_children(bookable_id);

-- Modes can require a specific configuration of their scoped bookables. When
-- set, the booking flow looks for that configuration on every bookable in
-- activity_mode_bookables (or every bookable the activity is linked to, when
-- the mode has no explicit scope) and surfaces the union of children as one
-- candidate pool — auto-picking the first available.
alter table activity_modes
  add column if not exists configuration_key text;
