-- Optional equipment per mode.
--
-- `activity_mode_required_items` already tracks items auto-reserved with
-- a booking (locked, not customer-pickable). Adding `is_optional` lets a
-- mode also declare items the customer can opt into — e.g. a Birthday
-- mode that always reserves the hall + lets the customer optionally add
-- a PA system or projector.
--
-- The org's broader item catalogue is no longer surfaced to customers
-- via the booker; only items explicitly listed on the mode (required or
-- optional) appear there.

alter table activity_mode_required_items
  add column if not exists is_optional boolean not null default false;

create index if not exists activity_mode_required_items_optional_idx
  on activity_mode_required_items(mode_id) where is_optional = true;
