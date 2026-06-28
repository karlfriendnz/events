-- 125_page_reviews.sql
-- In-app prototype review system: per-route stage + pinned comments.
-- A page is identified by its URL path (route.path). Each (org_id, path)
-- gets one review row tracking lifecycle stage; comments are pinned at
-- (x, y) coordinates within the page's <main> scroll container.

create table if not exists page_reviews (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  path         text not null,
  stage        text not null default 'draft'
                check (stage in ('draft','in_review','approved')),
  approved_by  uuid,
  approved_at  timestamptz,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique (org_id, path)
);
create index if not exists page_reviews_org_idx on page_reviews(org_id);

create table if not exists page_comments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null,
  path         text not null,
  body         text not null,
  author_id    uuid,
  author_name  text,
  -- Pin coordinates inside the <main> scroll container, in pixels. Null
  -- for "general" comments not anchored to any specific spot.
  x            numeric,
  y            numeric,
  resolved     boolean not null default false,
  resolved_by  uuid,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists page_comments_path_idx     on page_comments(org_id, path);
create index if not exists page_comments_open_idx     on page_comments(org_id, resolved) where resolved = false;
