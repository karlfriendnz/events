-- Configurations are now slot-aware: a configuration like "Halves" can have
-- 2 slots, where each slot groups multiple physical sub-venues (e.g.
-- Half A = {Q1, Q2}, Half B = {Q3, Q4}). Booking a slot blocks every
-- sub-venue in it.
--
-- Coarser configurations no longer create their own physical sub-venues —
-- only the finest required division is materialised; coarser ones are
-- groupings on top of those.
alter table bookable_configuration_children
  add column if not exists slot_index int not null default 0;

alter table bookable_configuration_children
  add column if not exists slot_name text;

create index if not exists bookable_configuration_children_slot_idx
  on bookable_configuration_children(configuration_id, slot_index);
