-- Per-mode custom field answers for a booking. Forward-compatible with the
-- upcoming feature where activity modes can declare custom questions.
alter table bookings add column if not exists custom_fields jsonb not null default '{}';
