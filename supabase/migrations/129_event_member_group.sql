-- Link an event to a member group. Used by attendance events
-- (events.style='ATTENDANCE') so a group can have a recurring
-- "attendance" event tied directly to it.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS member_group_id uuid
    REFERENCES member_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS events_member_group_id_idx
  ON events(member_group_id);
