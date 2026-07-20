CREATE TABLE `event_org_invitees` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`invited_by_org_id` varchar(36),
	`status` text NOT NULL,
	`invited_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_org_invitees_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_org_invitees_event_org_unique` UNIQUE(`event_id`,`org_id`)
);
