-- Site-level default payment methods. Each key is a method (card / bank / cash / invoice),
-- value is a boolean. Activity modes inherit these unless they set their own payment_options.
alter table organisations
  add column if not exists default_payment_options jsonb not null default '{}'::jsonb;
