-- ============================================================
-- Communications log per event
-- ============================================================
create table if not exists communications (
  id               uuid primary key default uuid_generate_v4(),
  event_id         uuid references events(id) on delete cascade,
  session_id       uuid references sessions(id) on delete set null,
  channel          text not null check (channel in ('EMAIL', 'SMS', 'PUSH', 'IN_APP')),
  subject          text,
  body             text,
  recipient_count  integer not null default 0,
  status           text not null default 'DRAFT' check (status in ('DRAFT', 'SCHEDULED', 'SENT', 'FAILED')),
  sent_at          timestamptz,
  scheduled_at     timestamptz,
  created_by       uuid references persons(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists communications_event_id_idx on communications(event_id);

-- ============================================================
-- Attendance records (separate from invitee status)
-- ============================================================
create table if not exists attendance (
  id          uuid primary key default uuid_generate_v4(),
  invitee_id  uuid not null references invitees(id) on delete cascade,
  session_id  uuid references sessions(id) on delete cascade,
  is_present  boolean not null default false,
  checked_in_at timestamptz,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (invitee_id, session_id)
);

create index if not exists attendance_invitee_id_idx on attendance(invitee_id);
create index if not exists attendance_session_id_idx on attendance(session_id);
