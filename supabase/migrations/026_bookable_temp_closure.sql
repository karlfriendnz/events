alter table bookables add column if not exists closed_from date;
alter table bookables add column if not exists closed_until date;
alter table bookables add column if not exists closure_reason text;
