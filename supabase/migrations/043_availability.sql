-- Availability rules: define who can book when
-- days_of_week: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
create table availability_rules (
  id           uuid primary key default gen_random_uuid(),
  bookable_id  uuid not null references bookables(id) on delete cascade,
  name         text not null,
  rule_type    text not null check (rule_type in ('OPEN', 'RESTRICTED', 'CLOSED')),
  days_of_week int[] not null default '{0,1,2,3,4,5,6}',
  time_from    time,
  time_to      time,
  eligibility  text not null default 'anyone' check (eligibility in ('anyone', 'members_only', 'membership_types', 'groups')),
  membership_types text[] not null default '{}',
  group_ids    uuid[] not null default '{}',
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz default now()
);

-- Recurring blocks: standing patterns that consume capacity
create table recurring_blocks (
  id            uuid primary key default gen_random_uuid(),
  bookable_id   uuid not null references bookables(id) on delete cascade,
  name          text not null,
  days_of_week  int[] not null default '{}',
  time_from     time not null,
  time_to       time not null,
  capacity_used int not null default 1,
  color         text not null default '#6B7280',
  is_active     boolean not null default true,
  created_at    timestamptz default now()
);
