CREATE TABLE `access_scans` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`bookable_id` varchar(36),
	`person_id` varchar(36),
	`credential` text NOT NULL,
	`door` text,
	`scanned_at` timestamp NOT NULL DEFAULT (now()),
	`result` text NOT NULL,
	`reason` text,
	`door_id` varchar(36),
	`booking_id` varchar(36),
	CONSTRAINT `access_scans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activities` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text NOT NULL,
	`icon` text NOT NULL,
	`status` text NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`require_mode` boolean NOT NULL,
	`approval_mode` text NOT NULL,
	`booking_window_days` int,
	`min_notice_hours` int,
	`cancellation_window_hours` int,
	`min_duration_mins` int,
	`max_duration_mins` int,
	`buffer_mins` int,
	`area_name_singular` text,
	`area_name_plural` text,
	`bookings_enabled` boolean NOT NULL,
	`allow_multi_slot` boolean NOT NULL,
	`allow_multi_slot_peak` boolean NOT NULL,
	`allow_kiosk` boolean NOT NULL,
	`allow_recurring` boolean NOT NULL,
	`allow_member_changes` boolean NOT NULL,
	`auto_remove_unpaid` boolean NOT NULL,
	`require_visitor_names` boolean NOT NULL,
	`hide_member_names` boolean NOT NULL,
	`image_url` text,
	`booking_flow` text NOT NULL,
	`mode_label` text NOT NULL,
	`mode_display` text NOT NULL,
	`assignment_mode` text NOT NULL,
	`staff_bookable_id` varchar(36),
	CONSTRAINT `activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_bookables` (
	`id` varchar(36) NOT NULL,
	`activity_id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	CONSTRAINT `activity_bookables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_groups` (
	`activity_id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	CONSTRAINT `activity_groups_activity_id_group_id_pk` PRIMARY KEY(`activity_id`,`group_id`)
);
--> statement-breakpoint
CREATE TABLE `activity_mode_bookables` (
	`mode_id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`price_override` decimal(12,2),
	CONSTRAINT `activity_mode_bookables_mode_id_bookable_id_pk` PRIMARY KEY(`mode_id`,`bookable_id`)
);
--> statement-breakpoint
CREATE TABLE `activity_mode_required_items` (
	`id` varchar(36) NOT NULL,
	`mode_id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`sort_order` int NOT NULL,
	`is_optional` boolean NOT NULL,
	`price_override` decimal(12,2),
	CONSTRAINT `activity_mode_required_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_mode_resources` (
	`mode_id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `activity_mode_resources_mode_id_bookable_id_pk` PRIMARY KEY(`mode_id`,`bookable_id`)
);
--> statement-breakpoint
CREATE TABLE `activity_modes` (
	`id` varchar(36) NOT NULL,
	`activity_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`image_url` text,
	`pricing` json NOT NULL,
	`addons` json NOT NULL,
	`min_people` int,
	`max_people` int,
	`min_visitors` int,
	`max_visitors` int,
	`allow_visitors` boolean NOT NULL,
	`form_id` varchar(36),
	`default_booking_view` text,
	`payment_options` json NOT NULL,
	`approval_mode` text NOT NULL,
	`configuration_key` text,
	`period_unit` text,
	`period_count` int NOT NULL,
	`term_type` text NOT NULL,
	`period_price` decimal(12,2),
	`category` text,
	CONSTRAINT `activity_modes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `addons` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`type` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price` decimal(12,2) NOT NULL,
	`xero_code` text,
	`stock_limit` int,
	`refund_policy` text,
	`visibility_rule` json,
	`options` json,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `addons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `attendance` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`person_id` varchar(36) NOT NULL,
	`attended` boolean NOT NULL,
	`marked_at` timestamp,
	`marked_by` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attendance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36),
	`entity_type` text NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`action` text NOT NULL,
	`actor_id` varchar(36),
	`before_data` json,
	`after_data` json,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `availability_rules` (
	`id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`rule_type` text NOT NULL,
	`days_of_week` json NOT NULL,
	`time_from` time,
	`time_to` time,
	`eligibility` json NOT NULL,
	`membership_types` json NOT NULL,
	`group_ids` json NOT NULL,
	`sort_order` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`capacity_used` int NOT NULL,
	`color` text NOT NULL,
	`price_tiers` json NOT NULL,
	`time_slots` json NOT NULL,
	`week_interval` smallint NOT NULL,
	`week_anchor` date,
	`month_week` smallint,
	`rrule` text,
	`bookable_mode_id` varchar(36),
	`activity_mode_ids` json,
	`max_concurrent` smallint,
	`valid_from` date,
	`valid_until` date,
	`replaced_by_rule_id` varchar(36),
	`invitee_modes` json,
	`invitee_groups` json,
	CONSTRAINT `availability_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`details` text,
	`is_default` boolean NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookable_closures` (
	`id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp NOT NULL,
	`is_recurring` boolean NOT NULL,
	`recurrence_rule` text,
	`reason` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookable_closures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookable_configuration_children` (
	`configuration_id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL,
	`slot_index` int NOT NULL,
	`slot_name` text,
	CONSTRAINT `bookable_configuration_children_configuration_id_bookable_id_pk` PRIMARY KEY(`configuration_id`,`bookable_id`)
);
--> statement-breakpoint
CREATE TABLE `bookable_configurations` (
	`id` varchar(36) NOT NULL,
	`parent_bookable_id` varchar(36) NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookable_configurations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookable_doors` (
	`bookable_id` varchar(36) NOT NULL,
	`door_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `bookable_doors_bookable_id_door_id_pk` PRIMARY KEY(`bookable_id`,`door_id`)
);
--> statement-breakpoint
CREATE TABLE `bookable_light_zones` (
	`bookable_id` varchar(36) NOT NULL,
	`zone_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL,
	CONSTRAINT `bookable_light_zones_bookable_id_zone_id_pk` PRIMARY KEY(`bookable_id`,`zone_id`)
);
--> statement-breakpoint
CREATE TABLE `bookable_modes` (
	`id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`min_players` int,
	`max_players` int,
	`sort_order` int NOT NULL,
	`price_per_hour` decimal(12,2),
	`price_per_slot` decimal(12,2),
	`flat_fee` decimal(12,2),
	`price_per_person` decimal(12,2),
	CONSTRAINT `bookable_modes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookables` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`internal_name` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`parent_id` varchar(36),
	`master_id` varchar(36),
	`is_slave_auto_assign` boolean NOT NULL,
	`is_public` boolean NOT NULL,
	`is_network` boolean NOT NULL,
	`max_concurrent` int NOT NULL,
	`location` text,
	`show_location` boolean NOT NULL,
	`description` text,
	`features` json,
	`rules` text,
	`images` json,
	`categories` json,
	`sports` json,
	`custom_fields` json,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`item_category` text,
	`default_booking_view` text,
	`closed_from` date,
	`closed_until` date,
	`closure_reason` text,
	`is_master` boolean NOT NULL,
	`customized_sections` json NOT NULL,
	`main_image` text,
	`sponsor_image` text,
	`show_in_menu` boolean NOT NULL,
	`sections` json,
	`space_type` text,
	`booking_limit_type` text NOT NULL,
	`booking_limit_count` int,
	`disallow_concurrent` boolean NOT NULL,
	`disallow_consecutive` boolean NOT NULL,
	`allow_modes_with_others` boolean NOT NULL,
	`allow_sub_venues` boolean NOT NULL,
	`auto_resolve_children` boolean NOT NULL,
	`access_enabled` boolean NOT NULL,
	`access_code_delivery` text NOT NULL,
	`access_code_length` int NOT NULL,
	`access_unlock_before_mins` int NOT NULL,
	`access_unlock_after_mins` int NOT NULL,
	`lighting_ramp_up_mins` int NOT NULL,
	`lighting_ramp_down_mins` int NOT NULL,
	`lighting_level_percent` int NOT NULL,
	CONSTRAINT `bookables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_discount_activities` (
	`discount_id` varchar(36) NOT NULL,
	`activity_id` varchar(36) NOT NULL,
	CONSTRAINT `booking_discount_activities_discount_id_activity_id_pk` PRIMARY KEY(`discount_id`,`activity_id`)
);
--> statement-breakpoint
CREATE TABLE `booking_discount_activity_modes` (
	`discount_id` varchar(36) NOT NULL,
	`activity_mode_id` varchar(36) NOT NULL,
	CONSTRAINT `booking_discount_activity_modes_discount_id_activity_mode_id_pk` PRIMARY KEY(`discount_id`,`activity_mode_id`)
);
--> statement-breakpoint
CREATE TABLE `booking_discounts` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`form_text` text,
	`modifier_type` text NOT NULL,
	`modifier_value` decimal(12,2) NOT NULL,
	`apply_to` text NOT NULL,
	`conditions` json NOT NULL,
	`valid_from` timestamp,
	`valid_until` timestamp,
	`max_uses` int,
	`uses_count` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_discounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_items` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_window_slots` (
	`id` varchar(36) NOT NULL,
	`window_id` varchar(36) NOT NULL,
	`slot_start` time NOT NULL,
	`slot_end` time NOT NULL,
	`capacity` int NOT NULL,
	`label` text,
	`sort_order` int NOT NULL,
	CONSTRAINT `booking_window_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_windows` (
	`id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`window_type` text NOT NULL,
	`days_of_week` json NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`slot_duration_mins` int,
	`buffer_mins` int NOT NULL,
	`capacity` int NOT NULL,
	`sort_order` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_windows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` varchar(36) NOT NULL,
	`bookable_id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`session_id` varchar(36),
	`type` text NOT NULL,
	`status` text NOT NULL,
	`start_at` timestamp NOT NULL,
	`end_at` timestamp NOT NULL,
	`recurrence_rule` text,
	`notes` text,
	`override_reason` text,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`purpose` text,
	`is_all_day` boolean NOT NULL,
	`mode_id` varchar(36),
	`activity_id` varchar(36),
	`activity_mode_id` varchar(36),
	`bookable_mode_id` varchar(36),
	`selected_addons` json NOT NULL,
	`attendee_count` int,
	`booking_discount_id` varchar(36),
	`discount_amount` decimal(12,2),
	`custom_fields` json NOT NULL,
	`parent_booking_id` varchar(36),
	`is_recurring` boolean NOT NULL,
	`access_code` text,
	`access_code_delivered_at` timestamp,
	`subject_person_id` varchar(36),
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`color` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`icon_url` text,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendar_categories` (
	`calendar_id` varchar(36) NOT NULL,
	`category_id` varchar(36) NOT NULL,
	CONSTRAINT `calendar_categories_calendar_id_category_id_pk` PRIMARY KEY(`calendar_id`,`category_id`)
);
--> statement-breakpoint
CREATE TABLE `calendars` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`pin_to_nav` boolean NOT NULL,
	`icon` text,
	`color` text,
	`settings` json,
	CONSTRAINT `calendars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`name` text NOT NULL,
	`color` text,
	`icon` text,
	`default_tc` text,
	`default_form_id` varchar(36),
	`default_xero_codes` json,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `circle_members` (
	`id` varchar(36) NOT NULL,
	`circle_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`role` text NOT NULL,
	`can_book_for` boolean NOT NULL,
	`can_view` boolean NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`is_lead` boolean NOT NULL,
	`can_register` boolean NOT NULL,
	`relationship` text,
	`is_primary` boolean NOT NULL,
	`receives_comms` boolean NOT NULL,
	`contact_type` text,
	CONSTRAINT `circle_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `circles` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`color` text,
	`image_url` text,
	CONSTRAINT `circles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `club_types` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`default_modules` json,
	`default_person_types` json,
	`default_terminology` json,
	`is_overall_default` boolean NOT NULL,
	CONSTRAINT `club_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `code_role_defs` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`code_lineage_id` varchar(36),
	`key` text NOT NULL,
	`label` text NOT NULL,
	`capabilities` json NOT NULL,
	`sort_order` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `code_role_defs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `code_staff` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`code_lineage_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`role_key` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `code_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comms_preferences` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`subject_person_id` varchar(36) NOT NULL,
	`categories` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comms_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communication_topics` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36),
	`name` text NOT NULL,
	`description` text,
	`channels` json NOT NULL,
	`is_core` boolean NOT NULL,
	`sort_order` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communication_topics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `communications` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`audience_filter` json,
	`recipient_count` int NOT NULL,
	`sent_by` text,
	`sent_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `communications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `connection_group_events` (
	`group_id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	CONSTRAINT `connection_group_events_group_id_event_id_pk` PRIMARY KEY(`group_id`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `connection_groups` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `connection_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_reports` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`config` json NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `custom_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dashboard_templates` (
	`org_id` varchar(36) NOT NULL,
	`user_type` varchar(191) NOT NULL,
	`config` json,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dashboard_templates_org_id_user_type_pk` PRIMARY KEY(`org_id`,`user_type`)
);
--> statement-breakpoint
CREATE TABLE `discipline_requirements` (
	`id` varchar(36) NOT NULL,
	`discipline_id` varchar(36) NOT NULL,
	`field_column` text,
	`field_definition_id` varchar(36),
	`field_key` text,
	`operator` text NOT NULL,
	`value` json,
	`exempt` boolean NOT NULL,
	`applies_to` json,
	`message` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`purpose` text NOT NULL,
	CONSTRAINT `discipline_requirements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `disciplines` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`sport` text,
	`code` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`parent_id` varchar(36),
	`applies_to` json,
	`person_type_keys` json,
	CONSTRAINT `disciplines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discounts` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`type` text NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`modifier_type` text NOT NULL,
	`modifier_value` decimal(12,2) NOT NULL,
	`usage_cap` int,
	`per_user_cap` int,
	`expires_at` timestamp,
	`eligibility` json,
	`linked_event_id` varchar(36),
	`min_sessions` int,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`form_text` text,
	`valid_from` timestamp,
	`apply_to` text NOT NULL,
	`conditions` json NOT NULL,
	CONSTRAINT `discounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `doors` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`location_note` text,
	`hardware_provider` text,
	`hardware_id` text,
	`default_unlock_seconds` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `doors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`key` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`type_key` text NOT NULL,
	`name` text NOT NULL,
	`custom_fields` json NOT NULL,
	`status` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `entity_members` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`entity_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`roles` json NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entity_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_disciplines` (
	`event_id` varchar(36) NOT NULL,
	`discipline_id` varchar(36) NOT NULL,
	CONSTRAINT `event_disciplines_event_id_discipline_id_pk` PRIMARY KEY(`event_id`,`discipline_id`)
);
--> statement-breakpoint
CREATE TABLE `event_notes` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_tasks` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`text` text NOT NULL,
	`done` boolean NOT NULL,
	`due_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`assignee_ids` json NOT NULL,
	`is_role` boolean NOT NULL,
	`role_capacity` int NOT NULL,
	CONSTRAINT `event_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`style` text NOT NULL,
	`status` text NOT NULL,
	`category_id` varchar(36),
	`secondary_category_id` varchar(36),
	`start_at` timestamp,
	`end_at` timestamp,
	`is_all_day` boolean NOT NULL,
	`recurrence_rule` text,
	`recurrence_parent_id` varchar(36),
	`location_type` text NOT NULL,
	`bookable_id` varchar(36),
	`address` text,
	`meeting_link` text,
	`capacity_min` int,
	`capacity_max` int,
	`show_attendee_list` boolean NOT NULL,
	`show_attendee_count` boolean NOT NULL,
	`allow_interest` boolean NOT NULL,
	`allow_guests` boolean NOT NULL,
	`max_guests_per_invitee` int,
	`hold_spot_enabled` boolean NOT NULL,
	`hold_spot_age_max` int,
	`phased_registration` boolean NOT NULL,
	`member_window_days` int NOT NULL,
	`public_opens_at` timestamp,
	`master_event_id` varchar(36),
	`sharing_config` json,
	`banner_url` text,
	`attachments` json,
	`tc_content` text,
	`is_featured` boolean NOT NULL,
	`is_public` boolean NOT NULL,
	`public_url_slug` text,
	`form_id` varchar(36),
	`xero_codes_locked` boolean NOT NULL,
	`created_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`locations` json,
	`has_waitlist` boolean NOT NULL,
	`sub_groups` json,
	`reg_open_at` timestamp,
	`reg_close_at` timestamp,
	`has_tickets` boolean NOT NULL,
	`publish_at` timestamp,
	`notes` text,
	`automation` json,
	`exdates` json NOT NULL,
	`hide_banner` boolean NOT NULL,
	`member_group_id` varchar(36),
	`member_group_schedule_id` varchar(36),
	`created_via` text,
	`invitation_email` json,
	`is_programme` boolean NOT NULL,
	`age_min` int,
	`age_max` int,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fee_components` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`session_id` varchar(36),
	`name` text NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`xero_code` text,
	`is_locked` boolean NOT NULL,
	`deposit_percent` decimal(12,2),
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fee_components_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fee_rules` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36),
	`session_id` varchar(36),
	`fee_component_id` varchar(36),
	`condition_type` text NOT NULL,
	`condition_value` json NOT NULL,
	`modifier_type` text NOT NULL,
	`modifier_value` decimal(12,2) NOT NULL,
	`evaluation_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fee_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `field_definitions` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`label` text NOT NULL,
	`key` text,
	`field_type` text NOT NULL,
	`options` json,
	`is_required` boolean NOT NULL,
	`help_text` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`rules` json NOT NULL,
	`target` text NOT NULL,
	`meta` json NOT NULL,
	`targets` json NOT NULL,
	CONSTRAINT `field_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_fields` (
	`id` varchar(36) NOT NULL,
	`form_id` varchar(36) NOT NULL,
	`field_type` text NOT NULL,
	`label` text NOT NULL,
	`placeholder` text,
	`help_text` text,
	`is_required` boolean NOT NULL,
	`is_event_only` boolean NOT NULL,
	`options` json,
	`conditions` json,
	`page_number` int NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`form_id` varchar(36),
	`context_type` text NOT NULL,
	`context_id` varchar(36),
	`status` text NOT NULL,
	`submitter_name` text,
	`submitter_email` text,
	`submitter_phone` text,
	`answers` json NOT NULL,
	`total_amount` decimal(12,2) NOT NULL,
	`discount_total` decimal(12,2) NOT NULL,
	`registration_id` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_codes` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`parent_id` varchar(36),
	`term_id` varchar(36),
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`member_type_key` text,
	`lineage_id` varchar(36),
	`role_minimums` json NOT NULL,
	`member_positions` json NOT NULL,
	`position_minimums` json NOT NULL,
	`sport_id` varchar(36),
	CONSTRAINT `group_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_fee_option_items` (
	`id` varchar(36) NOT NULL,
	`option_id` varchar(36) NOT NULL,
	`name` text,
	`amount` decimal(12,2),
	`account` text,
	`sort_order` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `group_fee_option_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_fee_options` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`fee_type` text NOT NULL,
	`period_unit` text,
	`period_count` int,
	`auto_renew` boolean,
	`instalment_count` int,
	`session_count` int,
	`prorata` boolean,
	`description` text,
	`sort_order` int,
	`status` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`due_date` date,
	`deposit_percent` decimal(12,2),
	CONSTRAINT `group_fee_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_views` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`config` json NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `help_articles` (
	`id` varchar(36) NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`explanation` text NOT NULL,
	`steps` json NOT NULL,
	`module` text,
	`resource` text,
	`route` text,
	`sort_order` int NOT NULL,
	`status` text NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `help_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invitees` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`person_id` varchar(36),
	`status` text NOT NULL,
	`hold_expires_at` timestamp,
	`waitlist_position` int,
	`invited_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`attended` boolean NOT NULL,
	`signed_out` boolean NOT NULL,
	`ticket_type` text,
	`fee_amount` decimal(12,2),
	`paid_at` timestamp,
	`sub_group_id` text,
	`roles` json,
	`role` text,
	`responded_at` timestamp,
	`invite_sent_at` timestamp,
	CONSTRAINT `invitees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `light_zones` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`hardware_provider` text,
	`hardware_id` text,
	`default_level_percent` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `light_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `location_staff` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`location_id` varchar(36),
	`person_id` varchar(36) NOT NULL,
	`role_key` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`sport_id` varchar(36),
	CONSTRAINT `location_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`color` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_group_disciplines` (
	`group_id` varchar(36) NOT NULL,
	`discipline_id` varchar(36) NOT NULL,
	CONSTRAINT `member_group_disciplines_group_id_discipline_id_pk` PRIMARY KEY(`group_id`,`discipline_id`)
);
--> statement-breakpoint
CREATE TABLE `member_group_memberships` (
	`group_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`role` text,
	`roles` json,
	`sub_group_id` text,
	`term_id` varchar(36),
	`plan_option_id` varchar(36),
	`start_date` date,
	`end_date` date,
	`auto_renew` boolean,
	`membership_status` text,
	`fee_option_id` varchar(36),
	`positions` json NOT NULL,
	CONSTRAINT `member_group_memberships_group_id_person_id_pk` PRIMARY KEY(`group_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `member_group_plans` (
	`id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `member_group_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_group_schedules` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`day_of_week` int NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`location` json NOT NULL,
	`name` text,
	CONSTRAINT `member_group_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_group_terms` (
	`id` varchar(36) NOT NULL,
	`group_id` varchar(36) NOT NULL,
	`term_id` varchar(36) NOT NULL,
	`fee` decimal(12,2),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `member_group_terms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_groups` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`parent_id` varchar(36),
	`code` text,
	`age_range` text,
	`capacity` int,
	`current_term` text,
	`term_fee` decimal(12,2),
	`sub_groups` json NOT NULL,
	`term_id` varchar(36),
	`lineage_id` varchar(36),
	`rolled_from_group_id` varchar(36),
	`gender_restriction` text,
	`code_id` varchar(36),
	`image_url` text,
	`head_person_id` varchar(36),
	`waitlist_id` varchar(36),
	`form_id` varchar(36),
	`discontinued_at` timestamp,
	`location_id` varchar(36),
	`kind` text NOT NULL,
	`membership_settings` json,
	`location_ids` json,
	CONSTRAINT `member_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_entitlements` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`membership_group_id` varchar(36) NOT NULL,
	`target_type` text NOT NULL,
	`target_id` varchar(36) NOT NULL,
	`sort_order` int,
	`created_at` timestamp DEFAULT (now()),
	`benefit_type` text NOT NULL,
	`benefit_value` decimal(12,2),
	CONSTRAINT `membership_entitlements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plan_options` (
	`id` varchar(36) NOT NULL,
	`plan_id` varchar(36) NOT NULL,
	`name` text,
	`period_unit` text NOT NULL,
	`period_count` int NOT NULL,
	`price` decimal(12,2),
	`auto_renew` boolean NOT NULL,
	`sort_order` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `membership_plan_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`status` text NOT NULL,
	`sort_order` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `membership_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`payload` json NOT NULL,
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`email_sent_at` timestamp,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_manager_grants` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`target_org_id` varchar(36),
	`capabilities` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `org_manager_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_members` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `org_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_sports` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`sport` text NOT NULL,
	`nso_org_id` varchar(36),
	`is_primary` boolean NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`display_name` text,
	`terminology` json,
	`affiliation_status` text NOT NULL,
	`requested_at` timestamp DEFAULT (now()),
	`decided_at` timestamp,
	`decided_by` varchar(36),
	CONSTRAINT `org_sports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_terms` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`status` text NOT NULL,
	`sort_order` int,
	`created_at` timestamp DEFAULT (now()),
	`signup_open` date,
	`signup_close` date,
	`set_id` varchar(36),
	CONSTRAINT `org_terms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organisations` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`parent_id` varchar(36),
	`slug` text,
	`logo_url` text,
	`currency` text NOT NULL,
	`locale` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`default_payment_options` json NOT NULL,
	`default_form_id` varchar(36),
	`default_payment_method` text,
	`default_bank_account_id` varchar(36),
	`events_default_payment_options` json NOT NULL,
	`events_default_payment_method` text,
	`events_default_bank_account_id` varchar(36),
	`booker_theme` json NOT NULL,
	`season_start` date,
	`season_end` date,
	`org_level` text NOT NULL,
	`member_form_id` varchar(36),
	`terminology` json NOT NULL,
	`default_sport_name` text,
	`club_type_ids` json NOT NULL,
	`brand_id` varchar(36),
	`icon_url` text,
	`dashboard_config` json,
	`dashboard_banner_url` text,
	`profile_dashboard` json,
	`brand_color` text,
	`brand_text_color` text,
	`people_columns` json,
	`core_fields` json NOT NULL,
	`default_member_positions` json NOT NULL,
	`enabled_modules` json,
	`onboarding` json,
	`short_name` text,
	`address` text,
	`country` text,
	`timezone` text,
	`email` text,
	`phone` text,
	`website` text,
	`member_pull_mode` text,
	`is_sandbox` boolean NOT NULL,
	CONSTRAINT `organisations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_comments` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`path` text NOT NULL,
	`body` text NOT NULL,
	`author_id` varchar(36),
	`author_name` text,
	`x` decimal(12,2),
	`y` decimal(12,2),
	`resolved` boolean NOT NULL,
	`resolved_by` varchar(36),
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`reviewer_id` varchar(36),
	`parent_id` varchar(36),
	`anchor_selector` text,
	CONSTRAINT `page_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_reviewers` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`role` text,
	`color` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_reviewers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_reviews` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`path` text NOT NULL,
	`stage` text NOT NULL,
	`approved_by` varchar(36),
	`approved_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `page_signoffs` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`path` text NOT NULL,
	`reviewer_id` varchar(36) NOT NULL,
	`signed_by_user_id` varchar(36),
	`note` text,
	`signed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `page_signoffs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permission_group_members` (
	`group_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permission_group_members_group_id_person_id_pk` PRIMARY KEY(`group_id`,`person_id`)
);
--> statement-breakpoint
CREATE TABLE `permission_groups` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36),
	`name` text NOT NULL,
	`description` text,
	`permissions` json NOT NULL,
	`is_system` boolean NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`is_core` boolean NOT NULL,
	`source_group_id` varchar(36),
	CONSTRAINT `permission_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_memberships` (
	`id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`discipline_id` varchar(36),
	`sport` text,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `person_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_notes` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`body` text NOT NULL,
	`tags` json NOT NULL,
	`author_id` varchar(36),
	`author_name` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`links` json NOT NULL,
	`visibility` text NOT NULL,
	`is_important` boolean NOT NULL,
	`visible_to` json NOT NULL,
	`due_date` date,
	`channel` text,
	CONSTRAINT `person_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_target_types` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36),
	`key` text NOT NULL,
	`label` text NOT NULL,
	`min_count` int NOT NULL,
	`max_count` int,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`kind` text NOT NULL,
	`permissions` json NOT NULL,
	`member_slots` json NOT NULL,
	`is_global` boolean NOT NULL,
	`is_access` boolean NOT NULL,
	`landing_path` text,
	`profile_dashboard` json,
	`menu_items` json,
	`is_published` boolean NOT NULL,
	CONSTRAINT `person_target_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `person_type_links` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`type_id` varchar(36) NOT NULL,
	`source_type_id` varchar(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `person_type_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `persons` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`dob` date,
	`gender` text,
	`membership_type` text,
	`custom_fields` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`photo_url` text,
	`person_type` text,
	`person_types` json,
	`comms_topics` json,
	`phone2` text,
	`invited_at` timestamp,
	CONSTRAINT `persons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `physical_schedules` (
	`id` varchar(36) NOT NULL,
	`booking_id` varchar(36),
	`event_id` varchar(36),
	`session_id` varchar(36),
	`bookable_id` varchar(36),
	`door_id` varchar(36),
	`light_zone_id` varchar(36),
	`scheduled_on_at` timestamp NOT NULL,
	`scheduled_off_at` timestamp NOT NULL,
	`level_percent` int,
	`override_on_at` timestamp,
	`override_off_at` timestamp,
	`delivered_at` timestamp,
	`delivery_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `physical_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`bookable_id` varchar(36),
	`booking_type_id` varchar(36),
	`pricing_tier_id` varchar(36),
	`label` text,
	`day_of_week` json,
	`time_from` time,
	`time_to` time,
	`price_per_hour` decimal(12,2),
	`flat_price` decimal(12,2),
	`half_day_price` decimal(12,2),
	`full_day_price` decimal(12,2),
	`is_peak` boolean NOT NULL,
	`priority` int NOT NULL,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pricing_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profile_forms` (
	`org_id` varchar(36) NOT NULL,
	`type_key` varchar(191) NOT NULL,
	`config` json NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `profile_forms_org_id_type_key_pk` PRIMARY KEY(`org_id`,`type_key`)
);
--> statement-breakpoint
CREATE TABLE `registration_form_targets` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`form_id` varchar(36) NOT NULL,
	`target_type` text NOT NULL,
	`target_id` varchar(36) NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `registration_form_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registration_forms` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`is_template` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`config` json NOT NULL,
	CONSTRAINT `registration_forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registration_sessions` (
	`id` varchar(36) NOT NULL,
	`registration_id` varchar(36) NOT NULL,
	`session_id` varchar(36) NOT NULL,
	`status` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `registration_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registration_ticket_items` (
	`id` varchar(36) NOT NULL,
	`registration_id` varchar(36) NOT NULL,
	`ticket_type_id` varchar(36) NOT NULL,
	`quantity` int NOT NULL,
	`unit_price` decimal(12,2) NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `registration_ticket_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`person_id` varchar(36),
	`guest_name` text,
	`guest_email` text,
	`status` text NOT NULL,
	`ticket_id` text,
	`total_amount` decimal(12,2) NOT NULL,
	`paid_amount` decimal(12,2) NOT NULL,
	`hold_expires_at` timestamp,
	`parent_email` text,
	`parent_confirmed_at` timestamp,
	`form_answers` json,
	`discount_ids` json,
	`applied_discount_total` decimal(12,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`checked_in_at` timestamp,
	CONSTRAINT `registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_folders` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`parent_id` varchar(36),
	`name` text NOT NULL,
	`override_targets` boolean NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `resource_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_targets` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`owner_type` text NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`target_type` text NOT NULL,
	`target_id` varchar(36) NOT NULL,
	`sort_order` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `resource_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resource_views` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`resource_id` varchar(36) NOT NULL,
	`person_id` varchar(36),
	`user_id` varchar(36),
	`kind` text NOT NULL,
	`seconds` int,
	`source` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `resource_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `resources` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`folder_id` varchar(36),
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`description` text,
	`override_targets` boolean NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scoped_role_defs` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`resource_type` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`role_group` text NOT NULL,
	`capabilities` json NOT NULL,
	`field_type` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scoped_role_defs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`parent_session_id` varchar(36),
	`title` text NOT NULL,
	`description` text,
	`start_at` timestamp,
	`end_at` timestamp,
	`location_type` text NOT NULL,
	`bookable_id` varchar(36),
	`address` text,
	`meeting_link` text,
	`is_required` boolean NOT NULL,
	`capacity_min` int,
	`capacity_max` int,
	`visibility_rule` json,
	`restrictions` json,
	`access_profile_id` varchar(36),
	`lighting_profile_id` varchar(36),
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	`session_kind` text NOT NULL,
	`show_as_separate_event` boolean NOT NULL,
	`has_waitlist` boolean NOT NULL,
	`is_public` boolean NOT NULL,
	`show_attendee_list` boolean NOT NULL,
	`is_all_day` boolean NOT NULL,
	`display_on_form` boolean NOT NULL,
	`is_master` boolean NOT NULL,
	`master_id` varchar(36),
	`invitee_modes` json,
	`invitee_groups` json,
	`eligibility` json,
	`admins` json NOT NULL,
	`addons` json NOT NULL,
	`exdates` json NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sport_categories` (
	`id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sport_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`due_at` timestamp,
	`assignee_id` varchar(36),
	`linked_person_id` varchar(36),
	`status` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `term_sets` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`sort_order` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`sport_id` varchar(36),
	`location_ids` json,
	CONSTRAINT `term_sets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_types` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`session_id` varchar(36),
	`name` text NOT NULL,
	`description` text,
	`price` decimal(12,2) NOT NULL,
	`capacity` int,
	`sort_order` int NOT NULL,
	`sales_open_at` timestamp,
	`sales_close_at` timestamp,
	`is_active` boolean NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` varchar(36) NOT NULL,
	`registration_id` varchar(36) NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`type` text NOT NULL,
	`payment_method` text,
	`xero_invoice_id` text,
	`xero_status` text,
	`refund_reason` text,
	`processed_by` varchar(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_dashboards` (
	`user_id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`config` json,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_dashboards_user_id_org_id_pk` PRIMARY KEY(`user_id`,`org_id`)
);
--> statement-breakpoint
CREATE TABLE `waitlist_entries` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`waitlist_id` varchar(36) NOT NULL,
	`person_id` varchar(36) NOT NULL,
	`status` text NOT NULL,
	`notes` text,
	`sort_order` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`priority` int NOT NULL,
	CONSTRAINT `waitlist_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `waitlists` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`name` text NOT NULL,
	`notes` text,
	`created_at` timestamp DEFAULT (now()),
	`order_mode` text NOT NULL,
	`term_id` varchar(36),
	`lineage_id` varchar(36),
	`rolled_from_id` varchar(36),
	CONSTRAINT `waitlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `xero_connections` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`tenant_id` text NOT NULL,
	`tenant_name` text,
	`refresh_token` text NOT NULL,
	`access_token` text,
	`access_token_expires_at` timestamp,
	`sales_account_code` text,
	`bank_account_code` text,
	`bank_account_name` text,
	`tax_type` text,
	`fee_accounts` json,
	`status` text NOT NULL,
	`connected_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `xero_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `xero_sync_errors` (
	`id` varchar(36) NOT NULL,
	`org_id` varchar(36) NOT NULL,
	`assoc_type` text,
	`assoc_id` varchar(36),
	`action` text,
	`endpoint` text,
	`message` text,
	`status` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `xero_sync_errors_id` PRIMARY KEY(`id`)
);
