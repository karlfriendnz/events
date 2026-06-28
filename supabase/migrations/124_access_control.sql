-- Physical access control: doors + light zones connected to bookables.
--
-- Replaces the unused access_profiles / lighting_profiles abstraction from
-- migration 001 with a simpler model: doors and light_zones are first-class
-- org-scoped entities, joined directly to bookables. A booking on a venue
-- materialises one physical_schedules row per connected door/zone covering
-- the unlock + lighting window.

-- 1. Drop old profile abstraction (was only ever a stub — no production data).
alter table bookables drop column if exists access_profile_id;
alter table bookables drop column if exists lighting_profile_id;
alter table events    drop column if exists access_profile_id;
alter table events    drop column if exists lighting_profile_id;
drop table if exists physical_schedules;
drop table if exists access_profiles;
drop table if exists lighting_profiles;

-- 2. Doors: physical access points (gates, magnetic locks, smart locks).
create table doors (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references organisations(id) on delete cascade,
  name                    text not null,
  location_note           text,
  hardware_provider       text,                       -- free text for now: zkteco / hid / brivo / nuki / mock
  hardware_id             text,                       -- vendor's identifier
  default_unlock_seconds  int  not null default 5,
  is_active               boolean not null default true,
  created_at              timestamptz not null default now()
);
create index doors_org_id_idx on doors(org_id);

-- 3. Light zones: controllable lighting groups (LED zones, dimmer circuits).
create table light_zones (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references organisations(id) on delete cascade,
  name                     text not null,
  hardware_provider        text,
  hardware_id              text,
  default_level_percent    int  not null default 100 check (default_level_percent between 0 and 100),
  is_active                boolean not null default true,
  created_at               timestamptz not null default now()
);
create index light_zones_org_id_idx on light_zones(org_id);

-- 4. Joins: venue ↔ doors and venue ↔ light zones.
create table bookable_doors (
  bookable_id  uuid not null references bookables(id) on delete cascade,
  door_id      uuid not null references doors(id) on delete cascade,
  sort_order   int  not null default 0,
  primary key (bookable_id, door_id)
);
create index bookable_doors_door_id_idx on bookable_doors(door_id);

create table bookable_light_zones (
  bookable_id  uuid not null references bookables(id) on delete cascade,
  zone_id      uuid not null references light_zones(id) on delete cascade,
  sort_order   int  not null default 0,
  primary key (bookable_id, zone_id)
);
create index bookable_light_zones_zone_id_idx on bookable_light_zones(zone_id);

-- 5. Per-venue access settings.
alter table bookables add column if not exists access_enabled            boolean not null default false;
alter table bookables add column if not exists access_code_delivery      text    not null default 'none' check (access_code_delivery in ('none','email','sms','both'));
alter table bookables add column if not exists access_code_length        int     not null default 6 check (access_code_length between 4 and 12);
alter table bookables add column if not exists access_unlock_before_mins int     not null default 5;
alter table bookables add column if not exists access_unlock_after_mins  int     not null default 5;
alter table bookables add column if not exists lighting_ramp_up_mins     int     not null default 0;
alter table bookables add column if not exists lighting_ramp_down_mins   int     not null default 0;
alter table bookables add column if not exists lighting_level_percent    int     not null default 100 check (lighting_level_percent between 0 and 100);

-- 6. Per-booking access output.
alter table bookings add column if not exists access_code               text;
alter table bookings add column if not exists access_code_delivered_at  timestamptz;

-- 7. Recreate physical_schedules tied directly to a door or light_zone.
-- Each row is one materialised hardware command window. delivered_at
-- stays null until a worker pushes the command to the vendor API.
create table physical_schedules (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid references bookings(id) on delete cascade,
  event_id            uuid references events(id) on delete cascade,
  session_id          uuid references sessions(id) on delete cascade,
  bookable_id         uuid references bookables(id) on delete cascade,
  door_id             uuid references doors(id) on delete cascade,
  light_zone_id       uuid references light_zones(id) on delete cascade,
  scheduled_on_at     timestamptz not null,
  scheduled_off_at    timestamptz not null,
  level_percent       int,                  -- for lighting; null for doors
  override_on_at      timestamptz,
  override_off_at     timestamptz,
  delivered_at        timestamptz,
  delivery_error      text,
  created_at          timestamptz not null default now(),
  check (
    ((door_id is not null)::int + (light_zone_id is not null)::int) = 1
  )
);
create index physical_schedules_booking_id_idx     on physical_schedules(booking_id);
create index physical_schedules_scheduled_on_idx   on physical_schedules(scheduled_on_at);
create index physical_schedules_door_id_idx        on physical_schedules(door_id);
create index physical_schedules_light_zone_id_idx  on physical_schedules(light_zone_id);

-- 8. Update access_scans to optionally reference a door row (instead of free
-- text only) and the booking that authorised the scan.
alter table access_scans add column if not exists door_id     uuid references doors(id) on delete set null;
alter table access_scans add column if not exists booking_id  uuid references bookings(id) on delete set null;
create index if not exists access_scans_door_id_idx on access_scans(door_id);
create index if not exists access_scans_booking_id_idx on access_scans(booking_id);
