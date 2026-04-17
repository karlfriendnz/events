-- ============================================================
-- FriendlyManager Events Platform — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ORGANISATIONS
-- Hierarchy: NSO -> Club
-- ============================================================
create table organisations (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  type        text not null check (type in ('NSO', 'CLUB')),
  parent_id   uuid references organisations(id) on delete set null,
  slug        text unique,
  logo_url    text,
  currency    text not null default 'AUD',
  locale      text not null default 'en-AU',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES
-- Hierarchical taxonomy for events; carries default config
-- ============================================================
create table categories (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organisations(id) on delete cascade,
  parent_id           uuid references categories(id) on delete set null,
  name                text not null,
  color               text,
  icon                text,
  default_tc          text,
  default_form_id     uuid, -- FK added after forms table
  default_xero_codes  jsonb default '{}',
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ============================================================
-- PERSONS
-- Members and contacts in the system
-- ============================================================
create table persons (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text,
  phone           text,
  dob             date,
  gender          text check (gender in ('MALE', 'FEMALE', 'NON_BINARY', 'UNSPECIFIED')),
  membership_type text,
  custom_fields   jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index persons_org_id_idx on persons(org_id);
create index persons_email_idx on persons(email);

-- ============================================================
-- BOOKABLES
-- Venues, Persons, Items — hierarchical with master/slave
-- ============================================================
create table bookables (
  id                    uuid primary key default uuid_generate_v4(),
  org_id                uuid not null references organisations(id) on delete cascade,
  name                  text not null,
  internal_name         text,
  type                  text not null check (type in ('VENUE', 'PERSON', 'ITEM')),
  status                text not null default 'ACTIVE' check (status in ('ACTIVE', 'DRAFT', 'ARCHIVED', 'DELETED')),
  parent_id             uuid references bookables(id) on delete set null,
  master_id             uuid references bookables(id) on delete set null,
  is_slave_auto_assign  boolean not null default false,
  is_public             boolean not null default false,
  is_network            boolean not null default false,
  max_concurrent        integer not null default 1,
  location              text,
  show_location         boolean not null default true,
  description           text,
  features              text[],
  rules                 text,
  images                jsonb default '[]',
  categories            uuid[],
  sports                text[],
  custom_fields         jsonb default '{}',
  lighting_profile_id   uuid, -- FK added after profiles table
  access_profile_id     uuid, -- FK added after profiles table
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index bookables_org_id_idx on bookables(org_id);
create index bookables_parent_id_idx on bookables(parent_id);
create index bookables_master_id_idx on bookables(master_id);

-- Bookable temporary closure windows
create table bookable_closures (
  id               uuid primary key default uuid_generate_v4(),
  bookable_id      uuid not null references bookables(id) on delete cascade,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  is_recurring     boolean not null default false,
  recurrence_rule  text,
  reason           text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- EVENTS
-- Core event record; all styles share this table
-- ============================================================
create table events (
  id                  uuid primary key default uuid_generate_v4(),
  org_id              uuid not null references organisations(id) on delete cascade,
  title               text not null,
  description         text,
  style               text not null check (style in (
                        'BASIC', 'ADVANCED', 'MULTI_SESSION',
                        'SPORTS_COMPETITION', 'HOLIDAY_PROGRAM',
                        'ATTENDANCE', 'COMPETITION'
                      )),
  status              text not null default 'DRAFT' check (status in (
                        'DRAFT', 'PUBLISHED', 'CANCELLED', 'ARCHIVED'
                      )),
  category_id         uuid references categories(id) on delete set null,
  secondary_category_id uuid references categories(id) on delete set null,

  -- Dates
  start_at            timestamptz,
  end_at              timestamptz,
  is_all_day          boolean not null default false,
  recurrence_rule     text,
  recurrence_parent_id uuid references events(id) on delete cascade,

  -- Location
  location_type       text not null default 'ADDRESS' check (location_type in ('BOOKABLE', 'ADDRESS', 'ONLINE')),
  bookable_id         uuid references bookables(id) on delete set null,
  address             text,
  meeting_link        text,

  -- Capacity
  capacity_min        integer,
  capacity_max        integer,

  -- Invitee controls
  show_attendee_list  boolean not null default false,
  show_attendee_count boolean not null default true,
  allow_interest      boolean not null default false,
  allow_guests        boolean not null default false,
  max_guests_per_invitee integer,

  -- Registration controls
  hold_spot_enabled   boolean not null default false,
  hold_spot_age_max   integer,
  phased_registration boolean not null default false,
  member_window_days  integer not null default 40,
  public_opens_at     timestamptz,

  -- NSO sharing
  master_event_id     uuid references events(id) on delete set null,
  sharing_config      jsonb default '{}',

  -- Content
  banner_url          text,
  attachments         jsonb default '[]',
  tc_content          text,
  is_featured         boolean not null default false,
  is_public           boolean not null default false,
  public_url_slug     text unique,

  -- Registration form
  form_id             uuid, -- FK added after forms table

  -- Xero
  xero_codes_locked   boolean not null default false,

  created_by          uuid references persons(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index events_org_id_idx on events(org_id);
create index events_status_idx on events(status);
create index events_start_at_idx on events(start_at);
create index events_category_id_idx on events(category_id);
create index events_master_event_id_idx on events(master_event_id);

-- ============================================================
-- SESSIONS
-- Children of events; can have sub-sessions (one extra level)
-- ============================================================
create table sessions (
  id                  uuid primary key default uuid_generate_v4(),
  event_id            uuid not null references events(id) on delete cascade,
  parent_session_id   uuid references sessions(id) on delete cascade,
  title               text not null,
  description         text,
  start_at            timestamptz,
  end_at              timestamptz,
  location_type       text not null default 'ADDRESS' check (location_type in ('BOOKABLE', 'ADDRESS', 'ONLINE')),
  bookable_id         uuid references bookables(id) on delete set null,
  address             text,
  meeting_link        text,
  is_required         boolean not null default true,
  capacity_min        integer,
  capacity_max        integer,
  visibility_rule     jsonb default '{}',
  restrictions        jsonb default '{}',
  access_profile_id   uuid,
  lighting_profile_id uuid,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index sessions_event_id_idx on sessions(event_id);
create index sessions_parent_session_id_idx on sessions(parent_session_id);

-- ============================================================
-- CONNECTION GROUPS
-- Links related events for combined attendee management
-- ============================================================
create table connection_groups (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table connection_group_events (
  group_id    uuid not null references connection_groups(id) on delete cascade,
  event_id    uuid not null references events(id) on delete cascade,
  primary key (group_id, event_id)
);

-- ============================================================
-- INVITEES
-- Persons/groups attached to events/sessions with status
-- ============================================================
create table invitees (
  id                uuid primary key default uuid_generate_v4(),
  event_id          uuid not null references events(id) on delete cascade,
  session_id        uuid references sessions(id) on delete cascade,
  person_id         uuid references persons(id) on delete cascade,
  -- group_id added when groups table exists
  status            text not null default 'INVITED' check (status in (
                      'INVITED', 'CONFIRMED', 'DECLINED', 'EXCLUDED',
                      'INTERESTED', 'HOLD', 'WAITLISTED'
                    )),
  hold_expires_at   timestamptz,
  waitlist_position integer,
  invited_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (event_id, person_id)
);

create index invitees_event_id_idx on invitees(event_id);
create index invitees_person_id_idx on invitees(person_id);
create index invitees_status_idx on invitees(status);

-- ============================================================
-- FEE COMPONENTS
-- Named sub-amounts within a base fee; each maps to Xero code
-- ============================================================
create table fee_components (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid references events(id) on delete cascade,
  session_id      uuid references sessions(id) on delete cascade,
  name            text not null,
  amount          numeric(10,2) not null default 0,
  xero_code       text,
  is_locked       boolean not null default false,
  deposit_percent numeric(5,2),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  check (event_id is not null or session_id is not null)
);

create index fee_components_event_id_idx on fee_components(event_id);
create index fee_components_session_id_idx on fee_components(session_id);

-- ============================================================
-- FEE RULES
-- Conditional price modifiers; stackable, order-controlled
-- ============================================================
create table fee_rules (
  id                uuid primary key default uuid_generate_v4(),
  event_id          uuid references events(id) on delete cascade,
  session_id        uuid references sessions(id) on delete cascade,
  fee_component_id  uuid references fee_components(id) on delete cascade,
  condition_type    text not null check (condition_type in (
                      'GROUP', 'MEMBERSHIP', 'PERSON_TYPE', 'ROLE',
                      'TAG', 'FIELD_VALUE', 'AGE', 'GENDER',
                      'DISCIPLINE', 'QUALIFICATION', 'TIME_WINDOW'
                    )),
  condition_value   jsonb not null default '{}',
  modifier_type     text not null check (modifier_type in ('FLAT', 'PERCENT', 'REPLACE')),
  modifier_value    numeric(10,2) not null,
  evaluation_order  integer not null default 0,
  created_at        timestamptz not null default now()
);

create index fee_rules_event_id_idx on fee_rules(event_id);

-- ============================================================
-- ADD-ONS
-- Purchasable extras attached to events
-- ============================================================
create table addons (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references events(id) on delete cascade,
  session_id      uuid references sessions(id) on delete cascade,
  type            text not null check (type in ('OBJECT', 'FIELD_VALUE')),
  name            text not null,
  description     text,
  price           numeric(10,2) not null default 0,
  xero_code       text,
  stock_limit     integer,
  refund_policy   text,
  visibility_rule jsonb default '{}',
  options         jsonb default '[]', -- for FIELD_VALUE type
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- DISCOUNTS
-- ============================================================
create table discounts (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid references events(id) on delete cascade,
  type            text not null check (type in ('SIBLING', 'TRAINING_LINKED', 'CODE', 'ROLE')),
  name            text not null,
  code            text,
  modifier_type   text not null check (modifier_type in ('FLAT', 'PERCENT')),
  modifier_value  numeric(10,2) not null,
  usage_cap       integer,
  per_user_cap    integer,
  expires_at      timestamptz,
  eligibility     jsonb default '{}',
  linked_event_id uuid references events(id) on delete set null, -- for TRAINING_LINKED
  min_sessions    integer, -- for TRAINING_LINKED
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index discounts_event_id_idx on discounts(event_id);
create index discounts_code_idx on discounts(code);

-- ============================================================
-- REGISTRATIONS
-- Completed record of a person against an event
-- ============================================================
create table registrations (
  id                    uuid primary key default uuid_generate_v4(),
  event_id              uuid not null references events(id) on delete cascade,
  person_id             uuid references persons(id) on delete set null,
  -- Guest fields (when person_id is null)
  guest_name            text,
  guest_email           text,
  status                text not null default 'PENDING' check (status in (
                          'PENDING', 'HOLD', 'CONFIRMED', 'CANCELLED', 'WAITLISTED'
                        )),
  ticket_id             text unique,
  total_amount          numeric(10,2) not null default 0,
  paid_amount           numeric(10,2) not null default 0,
  hold_expires_at       timestamptz,
  parent_email          text,
  parent_confirmed_at   timestamptz,
  form_answers          jsonb default '{}',
  discount_ids          uuid[],
  applied_discount_total numeric(10,2) not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index registrations_event_id_idx on registrations(event_id);
create index registrations_person_id_idx on registrations(person_id);
create index registrations_status_idx on registrations(status);
create index registrations_ticket_id_idx on registrations(ticket_id);

-- Registration → session selections
create table registration_sessions (
  id              uuid primary key default uuid_generate_v4(),
  registration_id uuid not null references registrations(id) on delete cascade,
  session_id      uuid not null references sessions(id) on delete cascade,
  status          text not null default 'CONFIRMED' check (status in ('CONFIRMED', 'CANCELLED')),
  created_at      timestamptz not null default now(),
  unique (registration_id, session_id)
);

-- ============================================================
-- TRANSACTIONS
-- Payment, refund, and credit records
-- ============================================================
create table transactions (
  id                uuid primary key default uuid_generate_v4(),
  registration_id   uuid not null references registrations(id) on delete cascade,
  amount            numeric(10,2) not null,
  type              text not null check (type in ('PAYMENT', 'REFUND', 'CREDIT')),
  payment_method    text check (payment_method in ('CARD', 'INVOICE', 'DIRECT_DEBIT', 'ACCOUNT_CREDIT')),
  xero_invoice_id   text,
  xero_status       text check (xero_status in ('MATCHED', 'UNMATCHED', 'FAILED')),
  refund_reason     text,
  processed_by      uuid references persons(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index transactions_registration_id_idx on transactions(registration_id);

-- ============================================================
-- BOOKINGS
-- Resource reservations; event-driven or manual
-- ============================================================
create table bookings (
  id              uuid primary key default uuid_generate_v4(),
  bookable_id     uuid not null references bookables(id) on delete cascade,
  event_id        uuid references events(id) on delete cascade,
  session_id      uuid references sessions(id) on delete cascade,
  type            text not null check (type in (
                    'ONE_OFF', 'RECURRING', 'SEASONAL', 'EVENT_DRIVEN', 'PERSON'
                  )),
  status          text not null default 'CONFIRMED' check (status in (
                    'CONFIRMED', 'PENDING', 'CANCELLED'
                  )),
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  recurrence_rule text,
  notes           text,
  override_reason text,
  created_by      uuid references persons(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index bookings_bookable_id_idx on bookings(bookable_id);
create index bookings_event_id_idx on bookings(event_id);
create index bookings_start_at_end_at_idx on bookings(start_at, end_at);

-- ============================================================
-- REGISTRATION FORMS
-- ============================================================
create table registration_forms (
  id          uuid primary key default uuid_generate_v4(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,
  is_template boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table form_fields (
  id            uuid primary key default uuid_generate_v4(),
  form_id       uuid not null references registration_forms(id) on delete cascade,
  field_type    text not null check (field_type in (
                  'SHORT_TEXT', 'LONG_TEXT', 'SINGLE_SELECT', 'MULTI_SELECT',
                  'NUMBER', 'DATE', 'FILE', 'TOGGLE', 'SECTION_HEADER',
                  'PRICING_PREVIEW', 'TC_BLOCK', 'ELECTIVE_PICKER', 'PAYMENT'
                )),
  label         text not null,
  placeholder   text,
  help_text     text,
  is_required   boolean not null default false,
  is_event_only boolean not null default true,
  options       jsonb default '[]',
  conditions    jsonb default '[]',
  page_number   integer not null default 1,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index form_fields_form_id_idx on form_fields(form_id);

-- Now add FK for default_form_id on categories
alter table categories add foreign key (default_form_id) references registration_forms(id) on delete set null;

-- Now add FK for form_id on events
alter table events add foreign key (form_id) references registration_forms(id) on delete set null;

-- ============================================================
-- LIGHTING & ACCESS PROFILES
-- ============================================================
create table lighting_profiles (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  zones           jsonb default '[]',
  level_percent   integer not null default 100 check (level_percent between 0 and 100),
  ramp_up_mins    integer not null default 0,
  cool_down_mins  integer not null default 0,
  created_at      timestamptz not null default now()
);

create table access_profiles (
  id              uuid primary key default uuid_generate_v4(),
  org_id          uuid not null references organisations(id) on delete cascade,
  name            text not null,
  doors           jsonb default '[]',
  auth_criteria   jsonb default '[]',
  anti_passback   boolean not null default false,
  respect_capacity boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Add FK back to bookables
alter table bookables add foreign key (lighting_profile_id) references lighting_profiles(id) on delete set null;
alter table bookables add foreign key (access_profile_id) references access_profiles(id) on delete set null;

-- ============================================================
-- LIGHTING / ACCESS SCHEDULES
-- Auto-generated from events
-- ============================================================
create table physical_schedules (
  id                  uuid primary key default uuid_generate_v4(),
  event_id            uuid not null references events(id) on delete cascade,
  session_id          uuid references sessions(id) on delete cascade,
  bookable_id         uuid not null references bookables(id) on delete cascade,
  type                text not null check (type in ('LIGHTING', 'ACCESS')),
  profile_id          uuid not null,
  scheduled_on_at     timestamptz not null,
  scheduled_off_at    timestamptz not null,
  override_on_at      timestamptz,
  override_off_at     timestamptz,
  delivered_at        timestamptz,
  delivery_error      text,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- ACCESS SCANS
-- ============================================================
create table access_scans (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid references events(id) on delete set null,
  bookable_id     uuid references bookables(id) on delete set null,
  person_id       uuid references persons(id) on delete set null,
  credential      text not null,
  door            text,
  scanned_at      timestamptz not null default now(),
  result          text not null check (result in ('GRANT', 'DENY', 'UNKNOWN')),
  reason          text
);

create index access_scans_event_id_idx on access_scans(event_id);
create index access_scans_scanned_at_idx on access_scans(scanned_at);

-- ============================================================
-- TASKS
-- Action items linked to events
-- ============================================================
create table tasks (
  id              uuid primary key default uuid_generate_v4(),
  event_id        uuid not null references events(id) on delete cascade,
  title           text not null,
  description     text,
  due_at          timestamptz,
  assignee_id     uuid references persons(id) on delete set null,
  linked_person_id uuid references persons(id) on delete set null,
  status          text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'DONE')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index tasks_event_id_idx on tasks(event_id);
create index tasks_assignee_id_idx on tasks(assignee_id);

-- ============================================================
-- AUDIT LOG
-- Every create/edit/delete with before/after
-- ============================================================
create table audit_log (
  id            uuid primary key default uuid_generate_v4(),
  org_id        uuid references organisations(id) on delete cascade,
  entity_type   text not null,
  entity_id     uuid not null,
  action        text not null check (action in ('CREATE', 'UPDATE', 'DELETE', 'OVERRIDE')),
  actor_id      uuid references persons(id) on delete set null,
  before_data   jsonb,
  after_data    jsonb,
  note          text,
  created_at    timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log(entity_type, entity_id);
create index audit_log_org_id_idx on audit_log(org_id);
create index audit_log_created_at_idx on audit_log(created_at);

-- ============================================================
-- SEED: Demo organisation
-- ============================================================
insert into organisations (id, name, type, slug) values
  ('00000000-0000-0000-0000-000000000001', 'Demo NSO', 'NSO', 'demo-nso'),
  ('00000000-0000-0000-0000-000000000002', 'Demo Club', 'CLUB', 'demo-club');

update organisations set parent_id = '00000000-0000-0000-0000-000000000001'
  where id = '00000000-0000-0000-0000-000000000002';

insert into categories (id, org_id, name, color, icon) values
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000002', 'Training', '#3b82f6', 'dumbbell'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 'Camps & Programs', '#f59e0b', 'tent'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 'Competitions', '#ef4444', 'trophy');
