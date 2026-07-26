-- Postgres mirror of server/db/migrations/0019_review_comment_attachments.sql.
-- Images attached to a review comment ([{ url, name }]); see the drizzle file.

alter table page_comments add column if not exists attachments jsonb;
