-- The group a person was invited THROUGH (null = added individually). Persists the
-- "invited via {class}" grouping on the invitee row itself instead of reconstructing
-- it from live group membership (which breaks if they leave the group or are in several).
ALTER TABLE `invitees` ADD COLUMN `invited_via_group_id` varchar(36);
