-- Per-org theme for the public booker (/book embed). Three colours
-- cover the most visible elements:
--   • canvas    — page background under the cards / wizard / scheduler
--   • primary   — primary buttons, selected-state borders, brand accents
--   • on_primary — text/icon colour rendered on top of `primary`
-- Stored as jsonb so we can extend later (header image, accent radii…)
-- without another migration.
alter table organisations
  add column if not exists booker_theme jsonb not null default jsonb_build_object(
    'canvas',     '#F5F8FA',
    'primary',    '#1E2157',
    'on_primary', '#FFFFFF'
  );
