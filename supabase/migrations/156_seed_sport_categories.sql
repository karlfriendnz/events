-- ============================================================
-- 156_seed_sport_categories.sql
-- Seed a starter range of sport categories (super-admin Master catalogue,
-- managed at /admin/master). Idempotent: only seeds when the table is empty,
-- so it won't clobber super-admin edits on re-run.
-- ============================================================

insert into sport_categories (name, sort_order)
select name, ord from (values
  ('Team Sports',            0),
  ('Racquet Sports',         1),
  ('Aquatics & Water Sports', 2),
  ('Athletics & Running',    3),
  ('Combat & Martial Arts',  4),
  ('Gymnastics',             5),
  ('Cycling',                6),
  ('Winter Sports',          7),
  ('Target & Precision',     8),
  ('Outdoor & Adventure',    9),
  ('Equestrian',             10),
  ('Motorsport',             11),
  ('Dance & Movement',       12),
  ('Fitness & Wellness',     13),
  ('Strength & Conditioning', 14)
) as seed(name, ord)
where not exists (select 1 from sport_categories);
