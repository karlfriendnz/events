-- 173_circle_image.sql — circles get a picture (alongside the name + colour
-- added in 170/171). image_url is an uploaded avatar shown in the card header;
-- color (171) tints the header background.

alter table public.circles
  add column if not exists image_url text;
