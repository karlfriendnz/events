-- Swap the single bookable_id pointer for a full LocationEntry jsonb
-- so the schedule editor can use the standard <LocationEditor>
-- component (Address / Venue / Online tabs + multi-venue tree).
ALTER TABLE member_group_schedules
  ADD COLUMN IF NOT EXISTS location jsonb NOT NULL
    DEFAULT jsonb_build_object(
      'type', 'BOOKABLE',
      'venue_name', '',
      'address', '',
      'meeting_link', '',
      'bookable_ids', '[]'::jsonb
    );

-- Backfill: existing rows referencing a single bookable get mapped to a
-- BOOKABLE LocationEntry with that id in bookable_ids.
UPDATE member_group_schedules
SET location = jsonb_build_object(
  'type', 'BOOKABLE',
  'venue_name', '',
  'address', '',
  'meeting_link', '',
  'bookable_ids', jsonb_build_array(bookable_id::text)
)
WHERE bookable_id IS NOT NULL;

ALTER TABLE member_group_schedules
  DROP COLUMN IF EXISTS bookable_id;
