-- Postgres mirror of server/db/migrations/0018_review_comment_ready.sql.
-- See the drizzle file for the rationale (a comment is a suggestion until the
-- builder marks it ready; only ready comments can be sent to an agent).

alter table page_comments add column if not exists ready boolean not null default false;
alter table page_comments add column if not exists ready_at timestamptz;

update page_comments set ready = true, ready_at = created_at where ready = false;
