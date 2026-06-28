-- Default season range for an organisation. Used as the default
-- date scope for term-based features (group terms, attendance,
-- reporting windows).
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS season_start date,
  ADD COLUMN IF NOT EXISTS season_end   date;
