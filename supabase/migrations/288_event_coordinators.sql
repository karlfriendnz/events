-- Event coordinators (Postgres parity of drizzle 0014). People who administer an event
-- and receive chosen notifications (notifications jsonb = array of keys from
-- registration / payment / cancellation / capacity). Multiple per event; captured only.
create table if not exists event_coordinators (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  person_id uuid not null,
  notifications jsonb,
  created_at timestamptz not null default now()
);
create index if not exists event_coordinators_event_id_idx on event_coordinators (event_id);
