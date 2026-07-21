CREATE TABLE `calendar_org_invitees` (
	`id` varchar(36) NOT NULL,
	`calendar_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`invited_by_org_id` varchar(36),
	`status` text NOT NULL,
	`connections` json,
	`invited_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`decided_at` timestamp,
	CONSTRAINT `calendar_org_invitees_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendar_org_invitees_calendar_org_unique` UNIQUE(`calendar_id`,`org_id`)
);
