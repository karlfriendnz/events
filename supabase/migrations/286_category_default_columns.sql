-- Event category default attendee-roll columns (Postgres parity of drizzle 0012).
-- jsonb array of column keys (email/phone/roles/age/gender/membership + cf:<id>);
-- null = the roll's own auto defaults. Additive.
alter table categories add column if not exists default_columns jsonb;
