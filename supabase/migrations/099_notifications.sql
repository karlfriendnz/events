-- In-app notifications, scoped per org. Insert on booking creation; staff
-- mark them read from the bell menu.
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  link        text,
  payload     jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_org_id_idx on notifications(org_id, created_at desc);
create index if not exists notifications_unread_idx on notifications(org_id) where read_at is null;
