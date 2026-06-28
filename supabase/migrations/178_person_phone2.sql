-- 178_person_phone2.sql — a second phone number for every person (core field).
alter table public.persons
  add column if not exists phone2 text;
