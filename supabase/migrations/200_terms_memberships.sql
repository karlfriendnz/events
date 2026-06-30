-- ============================================================
-- Terms & Memberships
--
-- A club can bill/run a group two ways, and the org can run BOTH at once:
--
--   1. TERM model      — org defines shared date-ranged terms (Term 1 2026,
--                        Term 2 2026 …). A group attaches to one or more terms,
--                        each with its own fee. Fixed period, no auto-renew.
--
--   2. MEMBERSHIP model — org defines named recurring plans ("Senior",
--                        "Junior"). Each plan has one or more OPTIONS — a billing
--                        period (1 / 3 / 6 month …) + price — that auto-roll over.
--                        A group connects to one or more plans. The member is
--                        still a "Senior", they just pick a duration option.
--
-- A group can offer either or BOTH (driven by which join rows exist — no
-- exclusive mode flag). When a person registers they record WHICH model they
-- joined under on their member_group_memberships row.
-- ============================================================

-- ---------- TERM model ----------
create table if not exists org_terms (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organisations(id) on delete cascade,
  name       text not null,                       -- "Term 1 2026"
  start_date date not null,
  end_date   date not null,
  status     text not null default 'active',      -- active | archived
  sort_order int  default 0,
  created_at timestamptz default now()
);
create index if not exists org_terms_org_idx on org_terms(org_id);

-- which terms a group runs in, + the fee for that group/term
create table if not exists member_group_terms (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references member_groups(id) on delete cascade,
  term_id   uuid not null references org_terms(id) on delete cascade,
  fee       numeric(10,2),
  created_at timestamptz default now(),
  unique(group_id, term_id)
);
create index if not exists member_group_terms_group_idx on member_group_terms(group_id);
create index if not exists member_group_terms_term_idx  on member_group_terms(term_id);

-- ---------- MEMBERSHIP (recurring) model ----------
create table if not exists membership_plans (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  name        text not null,                      -- "Senior Membership"
  description text,
  color       text,
  status      text not null default 'active',     -- active | archived
  sort_order  int  default 0,
  created_at  timestamptz default now()
);
create index if not exists membership_plans_org_idx on membership_plans(org_id);

-- the billing options under a plan (Senior → 1mo / 3mo / 6mo)
create table if not exists membership_plan_options (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references membership_plans(id) on delete cascade,
  name         text,                              -- optional label e.g. "Monthly"
  period_unit  text not null default 'month',     -- week | month | year
  period_count int  not null default 1,           -- 1, 3, 6 …
  price        numeric(10,2),
  auto_renew   boolean not null default true,     -- rolls over at period end
  sort_order   int  default 0,
  created_at   timestamptz default now()
);
create index if not exists membership_plan_options_plan_idx on membership_plan_options(plan_id);

-- which membership plans a group offers
create table if not exists member_group_plans (
  id        uuid primary key default gen_random_uuid(),
  group_id  uuid not null references member_groups(id) on delete cascade,
  plan_id   uuid not null references membership_plans(id) on delete cascade,
  created_at timestamptz default now(),
  unique(group_id, plan_id)
);
create index if not exists member_group_plans_group_idx on member_group_plans(group_id);
create index if not exists member_group_plans_plan_idx  on member_group_plans(plan_id);

-- ---------- per-person enrolment detail ----------
-- Records what model a person joined a group under (set at registration).
alter table member_group_memberships add column if not exists term_id           uuid references org_terms(id) on delete set null;
alter table member_group_memberships add column if not exists plan_option_id    uuid references membership_plan_options(id) on delete set null;
alter table member_group_memberships add column if not exists start_date        date;
alter table member_group_memberships add column if not exists end_date          date;
alter table member_group_memberships add column if not exists auto_renew        boolean default false;
alter table member_group_memberships add column if not exists membership_status text;   -- active | expired | cancelled
