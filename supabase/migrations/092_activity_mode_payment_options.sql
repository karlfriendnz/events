-- Mode-level payment options. Each key is a method (card / bank / cash / invoice),
-- value is a boolean indicating whether that method is offered for this mode.
alter table activity_modes
  add column if not exists payment_options jsonb not null default '{}'::jsonb;
