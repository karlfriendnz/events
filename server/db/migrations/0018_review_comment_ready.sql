-- A comment is a SUGGESTION until the builder says it is work.
--
-- Anyone on the review team can leave a comment, and they should — that is the
-- point of the widget. But "someone typed a thought on a screen" and "this is a
-- job to be done" are different states, and only the second should ever reach an
-- agent. Without this gate, opening the review to the team would mean every
-- passing remark landing in a task brief unreviewed.
--
-- Karl's own comments are marked ready on creation (he IS the triage), so the
-- gate costs him nothing and only ever holds other people's suggestions.
--
-- Existing rows backfill to ready: they are all his, and a column added today
-- must not retroactively un-approve work that was already queued.

ALTER TABLE `page_comments` ADD COLUMN `ready` boolean NOT NULL DEFAULT false;
ALTER TABLE `page_comments` ADD COLUMN `ready_at` timestamp NULL;

UPDATE `page_comments` SET `ready` = true, `ready_at` = `created_at`;
