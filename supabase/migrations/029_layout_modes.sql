-- Add mode options to each layout (e.g. 'Playing', 'Practicing', 'Tournament')
create table if not exists bookable_layout_modes (
  id         uuid primary key default gen_random_uuid(),
  layout_id  uuid not null references bookable_layouts(id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0
);

create index if not exists bookable_layout_modes_layout_idx on bookable_layout_modes(layout_id);
