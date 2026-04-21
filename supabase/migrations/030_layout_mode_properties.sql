-- Extend layout modes with configurable properties
alter table bookable_layout_modes
  add column if not exists description   text,
  add column if not exists min_players   int,
  add column if not exists max_players   int,
  add column if not exists price         numeric(10,2) not null default 0,
  add column if not exists price_type    text not null default 'INCLUDED'
                             check (price_type in ('INCLUDED','FIXED','PER_HOUR','PER_PERSON','FREE'));
