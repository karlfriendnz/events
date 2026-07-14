-- Resource engagement (migration 260).
--
-- Who actually opened what. One row per interaction — NOT one row per person — so a
-- person opening the same PDF three times is three rows. "Unique viewers" is a
-- distinct-person count over this table; "open rate" is those viewers as a share of
-- the resource's resolved audience (resource_targets → groups / person types → people).
--
-- kind:
--   'open'     — clicked through to the resource (link, video, or a file opened inline)
--   'download' — pulled the file down (distinct from merely looking at it)
--   'watch'    — a video/doc was open for `seconds` (dwell). Emitted on close, so a
--                single viewing session is one row carrying its duration.
--
-- person_id is nullable: an admin previewing from the management screen has a user
-- but may have no persons row. Those views still log (honest total_opens) but can't
-- count toward the audience rate, which is exactly what we want.

create table if not exists resource_views (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  resource_id uuid not null references resources(id) on delete cascade,
  person_id uuid references persons(id) on delete set null,
  user_id uuid,
  kind text not null default 'open' check (kind in ('open', 'download', 'watch')),
  seconds int,
  source text,                                  -- 'library' | 'admin' | future surfaces
  created_at timestamptz not null default now()
);

-- The two hot paths: stats for one resource, and the org-wide rollup over a date window.
create index if not exists resource_views_resource_idx on resource_views (resource_id, created_at desc);
create index if not exists resource_views_org_idx on resource_views (org_id, created_at desc);
create index if not exists resource_views_person_idx on resource_views (person_id);
