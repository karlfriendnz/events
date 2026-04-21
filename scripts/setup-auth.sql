-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Create the org_members table linking users to orgs
CREATE TABLE IF NOT EXISTS org_members (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  org_id     uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, org_id)
);

ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memberships"
  ON org_members FOR SELECT
  USING (auth.uid() = user_id);

-- 2. After creating users in Supabase Auth (Dashboard → Authentication → Users),
--    run this to link each user to Demo Club org:
--
-- INSERT INTO org_members (user_id, org_id)
-- VALUES
--   ('<paste-user-uuid-here>', '00000000-0000-0000-0000-000000000002'),
--   ('<another-user-uuid>',    '00000000-0000-0000-0000-000000000002');
