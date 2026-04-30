-- Separate default Payment Options for events from the bookings ones.
-- Existing organisations.default_payment_options / default_payment_method /
-- default_bank_account_id continue to drive bookings; these new columns drive
-- the equivalent block on event registration forms.
alter table organisations
  add column if not exists events_default_payment_options jsonb not null default '{}'::jsonb,
  add column if not exists events_default_payment_method  text,
  add column if not exists events_default_bank_account_id uuid references bank_accounts(id) on delete set null;
