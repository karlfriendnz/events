-- 126_page_signoffs.sql
-- Multi-person sign-off layer over page_reviews. Each org has a list of
-- named reviewers (PM, CEO, customer rep, …) and each (path, reviewer)
-- can be independently signed off. The Report view in <ReviewWidget>
-- pivots this into a pages × reviewers matrix.

create table if not exists page_reviewers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null,
  name        text not null,
  role        text,
  color       text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists page_reviewers_org_idx on page_reviewers(org_id);

create table if not exists page_signoffs (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null,
  path               text not null,
  reviewer_id        uuid not null references page_reviewers(id) on delete cascade,
  signed_by_user_id  uuid,
  note               text,
  signed_at          timestamptz not null default now(),
  unique (org_id, path, reviewer_id)
);
create index if not exists page_signoffs_path_idx on page_signoffs(org_id, path);
create index if not exists page_signoffs_reviewer_idx on page_signoffs(reviewer_id);
