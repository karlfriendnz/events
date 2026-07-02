-- Session times can be named (e.g. "Beginners squad", "Bar work").
-- A nullable label on each weekly training schedule row; when set it also
-- becomes the generated training event's title on /groups/:id.
alter table member_group_schedules add column if not exists name text;
