-- Dedicated CLUB brand colours (distinct from the connected platform brand and
-- from booker_theme). These are the club's own identity colours used by branded
-- surfaces like the invitation email header (background + on-colour text) and,
-- going forward, app theming. Set in Settings → General → Branding.
--   brand_color      = the club's primary/background brand colour (e.g. header bg)
--   brand_text_color = the colour of text/marks sitting ON brand_color
-- Both null = fall back to the platform default (FriendlyManager navy on white).
alter table organisations
  add column if not exists brand_color text,
  add column if not exists brand_text_color text;
