alter table activities
  add column if not exists area_name_singular text,
  add column if not exists area_name_plural    text,
  add column if not exists bookings_enabled    boolean not null default true,
  add column if not exists allow_multi_slot    boolean not null default false,
  add column if not exists allow_multi_slot_peak boolean not null default false,
  add column if not exists allow_kiosk         boolean not null default false,
  add column if not exists allow_recurring     boolean not null default false,
  add column if not exists allow_member_changes boolean not null default false,
  add column if not exists auto_remove_unpaid  boolean not null default false,
  add column if not exists require_visitor_names boolean not null default false,
  add column if not exists hide_member_names   boolean not null default false;
