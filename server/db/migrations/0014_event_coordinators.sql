-- Event coordinators: people who administer an event and receive chosen notifications.
-- notifications = json array of keys from {registration, payment, cancellation, capacity}.
-- Multiple per event; the event creator is seeded as the default coordinator by the UI.
-- Captured only — actually sending the notifications is a follow-up.
CREATE TABLE `event_coordinators` (
  `id` varchar(36) NOT NULL,
  `event_id` varchar(36) NOT NULL,
  `person_id` varchar(36) NOT NULL,
  `notifications` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `event_coordinators_id` PRIMARY KEY(`id`)
);
