-- 257_event_created_via.sql
--
-- How was this event created? `style` can't answer that: the stepped wizard and
-- the "Custom" full-page editor both produce style='BASIC', so an unfinished
-- draft from either looked identical and reopened in the wrong place.
--
-- Drives where clicking an event takes you (pages/events/index.vue openEvent):
--   wizard   + DRAFT → back into the stepped wizard (/events/new-basic?draft=)
--   anything + live  → the full event page (/events/:id)
--   custom / advanced / multi → the full event page, in its own mode
--
-- Null = created before this column existed (or by a seed) → treated as 'custom',
-- i.e. the full event page. Nobody gets sent to the wizard by accident.
alter table events
  add column if not exists created_via text
    check (created_via in ('wizard', 'custom', 'advanced', 'multi'));

comment on column events.created_via is
  'Which builder made this event — decides where reopening it lands. Null = full event page.';
