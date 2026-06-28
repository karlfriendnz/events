-- Service category on a mode.
--
-- The booker leads with category cards (Tennis, Swimming, …). A
-- customer who wants "a tennis coach" clicks Tennis once and sees every
-- tennis-tagged mode from every coach + venue activity — no per-coach
-- drill-down required.
--
-- Free text with autocomplete in the mode editor (org distinct values)
-- — typo-safe enough for a small org without managing a separate
-- categories table.

alter table activity_modes
  add column if not exists category text;

create index if not exists activity_modes_category_idx
  on activity_modes(category)
  where category is not null;
