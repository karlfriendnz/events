-- 128_page_comment_anchors.sql
-- Lets a pin anchor itself to a dialog/modal that's currently open,
-- rather than always projecting against <main>. anchor_selector encodes
-- which element the pin's (x, y) are relative to:
--   null            → main-relative (legacy + default for clicks on the page)
--   "dialog:<id>"   → relative to a [role=dialog] whose header/label
--                     matches <id>; only rendered while that dialog is open

alter table page_comments
  add column if not exists anchor_selector text;
