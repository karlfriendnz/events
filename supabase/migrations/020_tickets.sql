-- Ticketing support for events and sessions

-- Enable ticketing per event (opt-in)
alter table events
  add column if not exists has_tickets boolean not null default false;

-- ============================================================
-- TICKET TYPES
-- Named ticket categories at event or session level
-- ============================================================
create table if not exists ticket_types (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  session_id      uuid references sessions(id) on delete cascade, -- null = event-level
  name            text not null,
  description     text,
  price           numeric(10,2) not null default 0,
  capacity        integer,                   -- null = unlimited
  sort_order      integer not null default 0,
  sales_open_at   timestamptz,
  sales_close_at  timestamptz,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create index ticket_types_event_id_idx   on ticket_types(event_id);
create index ticket_types_session_id_idx on ticket_types(session_id);

-- ============================================================
-- REGISTRATION TICKET ITEMS
-- Which ticket types (and quantities) a registration includes
-- ============================================================
create table if not exists registration_ticket_items (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  ticket_type_id  uuid not null references ticket_types(id) on delete restrict,
  quantity        integer not null default 1 check (quantity > 0),
  unit_price      numeric(10,2) not null,    -- snapshot at time of purchase
  subtotal        numeric(10,2) not null,
  created_at      timestamptz not null default now()
);

create index reg_ticket_items_reg_id_idx    on registration_ticket_items(registration_id);
create index reg_ticket_items_type_id_idx   on registration_ticket_items(ticket_type_id);
