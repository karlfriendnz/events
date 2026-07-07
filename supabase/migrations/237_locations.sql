-- LOCATIONS: a club's operational SITES (HBC, Albany…) — deliberately NOT the
-- booking-engine venues (a booked court is inventory inside a site; a site may
-- not be bookable at all). Minimal on purpose.
--   locations        — the sites themselves (Settings → Locations)
--   member_groups.location_id — which site a class belongs to
--   location_staff   — person × location × role (a staff member can hold roles
--                      at MULTIPLE locations; mirrors code_staff). Drives the
--                      per-location staff-access gating (follow-up phase) and
--                      club-level per-location reporting.
-- Progressive disclosure: location UI only appears when a club has 2+ sites.
create table if not exists locations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  name       text not null,
  address    text,
  color      text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists locations_org_idx on locations(org_id);

alter table member_groups add column if not exists location_id uuid references locations(id) on delete set null;
create index if not exists member_groups_location_idx on member_groups(location_id);

create table if not exists location_staff (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  person_id   uuid not null references persons(id) on delete cascade,
  role_key    text not null default 'staff',
  created_at  timestamptz not null default now(),
  unique(location_id, person_id, role_key)
);
create index if not exists location_staff_person_idx on location_staff(person_id);
