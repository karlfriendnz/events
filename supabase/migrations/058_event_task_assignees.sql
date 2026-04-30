-- Create event_tasks if it doesn't exist yet (may have been created ad-hoc)
create table if not exists event_tasks (
  id          uuid primary key default uuid_generate_v4(),
  event_id    uuid not null references events(id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  due_date    date,
  created_at  timestamptz not null default now()
);

create index if not exists event_tasks_event_id_idx on event_tasks(event_id);

-- Add assignee_ids (array of person UUIDs)
alter table event_tasks add column if not exists assignee_ids uuid[] not null default '{}';
