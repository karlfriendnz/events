-- MEMBERSHIPS ON THE GROUP ENGINE (phase 1).
-- A membership IS a group without a timetable: same roster, fee options,
-- waitlist, restrictions, staff, codes. `kind` is the discriminator —
-- open-ended text (not an enum) so future kinds (or per-kind feature gating,
-- e.g. "this fee type is memberships-only") need no schema change.
alter table member_groups add column if not exists kind text not null default 'class';

-- ENTITLEMENTS: "holding this membership gives access to these things".
-- Mirrors registration_form_targets: target_type is open text — 'group' (one
-- class), 'code' (a whole programme, expanded dynamically), 'event', and later
-- 'booking', 'discount', … without schema change.
create table if not exists membership_entitlements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  membership_group_id uuid not null references member_groups(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  sort_order int default 0,
  created_at timestamptz default now(),
  unique(membership_group_id, target_type, target_id)
);
create index if not exists membership_entitlements_org_target_idx
  on membership_entitlements (org_id, target_type, target_id);
