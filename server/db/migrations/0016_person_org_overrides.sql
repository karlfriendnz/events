-- A governing body's PRIVATE overlay of edits on a club-owned person. The NSO can
-- edit an affiliated club's member; those edits live here (keyed by the NSO's org_id
-- + the person_id) and never touch the club's persons row until the NSO explicitly
-- pushes them. `core` = overridden identity/contact columns; `custom_fields` =
-- overridden NSO field values (by field_definition id).
CREATE TABLE `person_org_overrides` (
  `id` varchar(36) NOT NULL,
  `org_id` varchar(36) NOT NULL,
  `person_id` varchar(36) NOT NULL,
  `core` json,
  `custom_fields` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `person_org_overrides_id` PRIMARY KEY(`id`),
  CONSTRAINT `person_org_overrides_uniq` UNIQUE(`org_id`,`person_id`)
);
