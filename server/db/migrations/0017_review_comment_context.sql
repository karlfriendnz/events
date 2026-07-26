-- Review comments learn WHAT THEY POINT AT, and who has actioned them.
--
-- Until now a pin stored only (x, y) inside <main>. That is enough to redraw the
-- pin and nothing else: "Padding" at (126, 186) is unreadable to anyone who
-- wasn't holding the mouse, and the pin drifts off its target the moment the
-- window resizes or a section above it reflows.
--
-- `context` holds the captured ReviewTarget (utils/reviewTarget.ts): the field
-- label, the section, the enclosing dialog, the owning Vue component + source
-- file, and a structural dom_path + in-element offset so the pin can be redrawn
-- FROM ITS ELEMENT rather than from frozen coordinates. x/y stay as the
-- fallback for old comments and for elements that no longer resolve.
--
-- `claude_status` / `claude_note` are the agent hand-back: when Claude actions a
-- comment it marks it 'done' with a note on what changed. The comment stays
-- OPEN and shows a robot icon — a human still signs it off. Nothing an agent
-- did disappears from the list before a person has looked at it.

ALTER TABLE `page_comments` ADD COLUMN `context` json;
ALTER TABLE `page_comments` ADD COLUMN `claude_status` varchar(20);
ALTER TABLE `page_comments` ADD COLUMN `claude_note` text;
ALTER TABLE `page_comments` ADD COLUMN `claude_at` timestamp NULL;
