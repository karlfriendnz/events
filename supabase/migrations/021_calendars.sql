-- Calendars are named groupings (no colour) that can contain multiple categories.
-- They are distinct from categories which carry colour/icon and are assigned per event.

create table if not exists calendars (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  name       text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index calendars_org_id_idx on calendars(org_id);

-- Many-to-many: calendars <-> categories
create table if not exists calendar_categories (
  calendar_id uuid not null references calendars(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (calendar_id, category_id)
);
