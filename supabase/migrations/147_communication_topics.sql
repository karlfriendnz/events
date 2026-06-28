-- Communication topics ("subjects" a person can subscribe to during registration).
-- Each topic is delivered by the listed channels (email / app). Core topics
-- (is_core = true, org_id null) are inherited by every club; clubs add their own
-- (org_id set). Mirrors the permission_groups core-vs-own pattern.
create table if not exists communication_topics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisations(id) on delete cascade,
  name text not null,
  description text,
  channels text[] not null default array['email','app']::text[],
  is_core boolean not null default false,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_communication_topics_org_id on communication_topics(org_id);

-- Seed a few inherited (core) topics so the field works out of the box. Idempotent.
insert into communication_topics (org_id, name, description, channels, is_core, sort_order)
select v.org_id, v.name, v.description, v.channels, true, v.sort_order
from (values
  (null::uuid, 'Club news',         'General club announcements and news',     array['email','app']::text[], 1),
  (null::uuid, 'Team updates',      'Team selections, training and results',   array['email','app']::text[], 2),
  (null::uuid, 'Match fixtures',    'Upcoming fixtures and schedule changes',  array['email','app']::text[], 3),
  (null::uuid, 'Payment reminders', 'Invoices, fees and payment reminders',    array['email']::text[],       4)
) as v(org_id, name, description, channels, sort_order)
where not exists (select 1 from communication_topics ct where ct.is_core and ct.name = v.name);
