-- ============================================================
-- Group views — saved, configurable Classes-style overview pages.
--
-- A "view" is a named configuration of the /groups/classes screen: which
-- columns show (head / gymnasts / waitlist / sport) and which top-level codes
-- appear as tabs (empty = all). Each view renders at /groups/view/:id and is
-- listed in a dropdown off the Groups nav item. Managed at /groups/views.
--
-- config shape: { "columns": ["head","gymnasts","waitlist","sport"],
--                 "codeIds": ["<top-level group_codes id>", ...] }
-- ============================================================

create table if not exists group_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  name text not null,
  config jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists group_views_org_idx on group_views(org_id);
