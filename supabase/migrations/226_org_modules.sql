-- Club setup: which parts (modules) of the system this club has turned on.
-- null = everything enabled (default behaviour unchanged for existing clubs).
-- Stored as a jsonb array of enabled module keys, e.g. ["events","bookings","groups"].
alter table organisations add column if not exists enabled_modules jsonb;
