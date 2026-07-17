CREATE TABLE `organisations` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255),
	`org_level` varchar(32) NOT NULL DEFAULT 'CLUB',
	`parent_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `organisations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `organisations_parent_idx` ON `organisations` (`parent_id`);