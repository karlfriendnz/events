-- Which groups have access to an activity
create table if not exists activity_groups (
  activity_id uuid not null references activities(id) on delete cascade,
  group_id    uuid not null references member_groups(id) on delete cascade,
  primary key (activity_id, group_id)
);
