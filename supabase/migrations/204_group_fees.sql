-- ============================================================
-- Group fees — multiple ways to pay to join a group.
--
-- A group offers several FEE OPTIONS (Full upfront, Monthly, 10-session
-- concession, …). A member CHOOSES how they want to be charged. Each option is
-- itself made of one or more LINE ITEMS (Coaching, Registration, Uniform levy…),
-- each with its own amount + GL/Xero account — so any fee can be multi-line.
--
-- Mirrors the legacy TermFee (charging model) + TermFeeItem (line items), lifted
-- to a clean group-scoped model. Supersedes the single member_group_terms.fee +
-- the membership-option enrol picker as "how a member pays to join this group".
--
-- fee_type:
--   upfront     — one payment for the whole term (prorata → reduce mid-term)
--   recurring   — charged every period (period_unit week|month|year × period_count; auto_renew)
--   instalment  — the total split into instalment_count fixed payments
--   concession  — prepay session_count sessions ("clips"), re-buy when used up
--   per_session — charged per session
-- (a "Free" option is just an upfront whose line items total 0)
-- ============================================================

create table if not exists group_fee_options (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references organisations(id) on delete cascade,
  group_id       uuid not null references member_groups(id) on delete cascade,
  name           text not null,                     -- "Full season upfront", "Monthly"
  fee_type       text not null default 'upfront',   -- upfront|recurring|instalment|concession|per_session
  period_unit    text,                              -- week|month|year (recurring)
  period_count   int  default 1,
  auto_renew     boolean default false,             -- recurring rolls over
  instalment_count int,                             -- instalment
  session_count  int,                               -- concession / per-session bundle
  prorata        boolean default false,             -- upfront: reduce when joining mid-term
  description    text,
  sort_order     int  default 0,
  status         text not null default 'active',    -- active | archived
  created_at     timestamptz default now()
);
create index if not exists group_fee_options_group_idx on group_fee_options(group_id);
create index if not exists group_fee_options_org_idx   on group_fee_options(org_id);

-- the line items that make up one fee option (the multi-line breakdown)
create table if not exists group_fee_option_items (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references group_fee_options(id) on delete cascade,
  name       text,                                  -- "Coaching", "Registration", "Uniform levy"
  amount     numeric(10,2) default 0,
  account    text,                                  -- GL / Xero account code
  sort_order int default 0,
  created_at timestamptz default now()
);
create index if not exists group_fee_option_items_option_idx on group_fee_option_items(option_id);

-- which fee option a person chose when they joined the group
alter table member_group_memberships add column if not exists fee_option_id uuid references group_fee_options(id) on delete set null;
