-- Postgres mirror of server/db/migrations/0017_review_comment_context.sql.
-- The review system lives on the MySQL seam; this keeps the Supabase copy of the
-- schema in step while the hybrid lasts. See the drizzle file for the rationale.

alter table page_comments add column if not exists context jsonb;
alter table page_comments add column if not exists claude_status text;
alter table page_comments add column if not exists claude_note text;
alter table page_comments add column if not exists claude_at timestamptz;
