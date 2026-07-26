-- Postgres mirror of server/db/migrations/0020_review_comment_seq.sql.
-- A comment's number is its NAME, not its position — see the drizzle file.

alter table page_comments add column if not exists seq integer;

update page_comments pc
set seq = t.rn
from (
  select id, row_number() over (partition by org_id, path order by created_at, id) as rn
  from page_comments
) t
where t.id = pc.id and pc.seq is null;
