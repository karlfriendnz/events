-- 177_person_comms_topics.sql — a person's own communication subscriptions.
-- Backs the required "Communication" profile field (the comms system field):
-- which of the club's comms topics this person is subscribed to (email/app).
-- Topic keys reuse COMMS_CATEGORIES (events/payments/attendance/results/general).
alter table public.persons
  add column if not exists comms_topics text[];
