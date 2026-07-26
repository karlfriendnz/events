-- @mentions on a review comment.
--
-- Feedback often needs one specific person ("@kate is this the wording you
-- wanted?"). Until now the only way to reach someone was to hope they visited
-- the same page — the panel shows the comments for the page you're standing on
-- and nothing else, so a question aimed at a teammate was effectively hidden.
--
-- Stored as REVIEWER IDS rather than parsed out of the body on demand: a
-- mention is a fact about who was addressed, and re-reading it from the text
-- would quietly break the moment somebody edits the wording or a reviewer is
-- renamed.

ALTER TABLE `page_comments` ADD COLUMN `mentions` json;
