-- 127_page_comment_threads.sql
-- Tie each comment back to the reviewer it was posted as (so the pin
-- inherits that person's brand colour) and add a self-FK for threaded
-- replies. Replies don't render as new pins on the page — they hang off
-- the parent in the comment list.

alter table page_comments
  add column if not exists reviewer_id uuid references page_reviewers(id) on delete set null;

alter table page_comments
  add column if not exists parent_id   uuid references page_comments(id) on delete cascade;

create index if not exists page_comments_parent_idx on page_comments(parent_id);
