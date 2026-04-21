alter table bookables
  add column if not exists main_image text,
  add column if not exists sponsor_image text;
