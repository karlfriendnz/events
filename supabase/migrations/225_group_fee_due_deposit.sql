-- Group fee options: a couple of the legacy fee-group fields.
--   due_date        — when the fee is due (a fixed date).
--   deposit_percent — an upfront deposit required, as a % of the option total.
alter table group_fee_options add column if not exists due_date date;
alter table group_fee_options add column if not exists deposit_percent numeric;
