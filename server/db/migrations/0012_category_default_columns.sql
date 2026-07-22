-- Event category default attendee-roll columns: which columns the attendance roll
-- shows by default for events in this category. json array of column keys (matching
-- <EventAttendance> allColumns: email/phone/roles/age/gender/membership + cf:<id>).
-- Nullable, no default (TiDB rejects json string-literal defaults). null = the roll's
-- own auto defaults.
ALTER TABLE `categories` ADD `default_columns` json;
