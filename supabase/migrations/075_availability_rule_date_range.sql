alter table availability_rules
  add column if not exists valid_from  date,
  add column if not exists valid_until date;
