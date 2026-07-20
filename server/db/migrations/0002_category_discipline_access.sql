ALTER TABLE `categories` ADD `default_discipline_id` varchar(36);--> statement-breakpoint
ALTER TABLE `categories` ADD `access_type_keys` json;--> statement-breakpoint
ALTER TABLE `categories` ADD `access_person_ids` json;