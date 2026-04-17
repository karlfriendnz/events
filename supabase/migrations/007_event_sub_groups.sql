ALTER TABLE events ADD COLUMN IF NOT EXISTS sub_groups JSONB DEFAULT '[]'::jsonb;
ALTER TABLE invitees ADD COLUMN IF NOT EXISTS sub_group_id text;
