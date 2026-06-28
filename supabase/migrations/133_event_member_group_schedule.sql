-- Link an event back to the specific weekly schedule row that produced
-- it. One training event per schedule row; all events for the same
-- group share `member_group_id`, so cross-training reporting still
-- aggregates naturally.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS member_group_schedule_id uuid
    REFERENCES member_group_schedules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_member_group_schedule_id_idx
  ON events(member_group_schedule_id);
