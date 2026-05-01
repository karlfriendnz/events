-- Per-activity customisation of how modes appear to the booker:
--   • mode_label   — what the picker calls them ("Mode" by default;
--                    could be "Format", "Theme", "Style" etc.).
--   • mode_display — visual layout in the Mode picker step. 'grid'
--                    keeps the current image-on-top tile, 'list' shows
--                    a horizontal row with the image on the left.
alter table activities
  add column if not exists mode_label text not null default 'Mode';

alter table activities
  add column if not exists mode_display text not null default 'grid'
  check (mode_display in ('grid', 'list'));
