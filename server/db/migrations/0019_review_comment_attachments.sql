-- Images attached to a review comment.
--
-- Some feedback is far faster to SHOW than to write: a marked-up screenshot, a
-- reference design, "make it look like this". `attachments` holds an array of
-- { url, name } as uploaded through /api/upload, so a comment can carry the
-- picture that explains it.
--
-- These are genuinely readable by an agent, not decoration: the uploader writes
-- to public/uploads/, so the task brief can cite a real path on disk that Claude
-- opens directly.
--
-- NB uploads currently land on local disk and do not survive a Vercel deploy
-- (the same caveat the resources library carries). Fine for the review loop,
-- which is a local-development tool.

ALTER TABLE `page_comments` ADD COLUMN `attachments` json;
