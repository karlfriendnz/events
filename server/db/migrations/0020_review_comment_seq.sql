-- A comment's number is its NAME, not its position.
--
-- Pins were numbered by their index in the open list, so the number was a
-- function of what happened to be open: resolve #3 and #4 becomes #3, #5
-- becomes #4, and every note, screenshot or conversation that said "pin 7" now
-- points at something else. The number is how a person refers to a comment out
-- loud, so it has to survive the list changing around it.
--
-- `seq` is assigned once per (org, path) and never reused — a resolved or
-- deleted comment takes its number with it. Gaps are the point, not a defect.
--
-- Backfilled in creation order so existing pins keep the numbers already seen.

ALTER TABLE `page_comments` ADD COLUMN `seq` int;

UPDATE `page_comments` pc
JOIN (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY org_id, `path` ORDER BY created_at, id) AS rn
    FROM `page_comments`
) t ON t.id = pc.id
SET pc.`seq` = t.rn;
