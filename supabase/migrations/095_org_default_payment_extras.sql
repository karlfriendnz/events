-- Which of the enabled payment methods is the "default" surfaced to customers,
-- and an opaque text field for the bank account details when Invoice is on.
alter table organisations
  add column if not exists default_payment_method text,
  add column if not exists payment_bank_account text;
