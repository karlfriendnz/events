-- Postgres mirror of server/db/migrations/0022_review_comment_mentions.sql.
-- @mentions on a review comment, stored as reviewer ids. See the drizzle file.

alter table page_comments add column if not exists mentions jsonb;
