-- Add parent_id to member_groups for hierarchy support
ALTER TABLE member_groups ADD COLUMN IF NOT EXISTS parent_id uuid references member_groups(id) on delete set null;

CREATE INDEX IF NOT EXISTS member_groups_parent_id_idx ON member_groups(parent_id);

-- Insert parent groups
INSERT INTO member_groups (id, org_id, name, color, sort_order) VALUES
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 'Seniors',        '#2563EB', 1),
  ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 'Juniors',        '#059669', 2),
  ('20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', 'Women''s',        '#EC4899', 3),
  ('20000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000002', 'Social & Staff', '#8B5CF6', 4)
ON CONFLICT (id) DO NOTHING;

-- Assign children to parents
UPDATE member_groups SET parent_id = '20000000-0000-0000-0000-000000000011', sort_order = 1
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',  -- Seniors Level 1
    '20000000-0000-0000-0000-000000000002',  -- Seniors Level 2
    '20000000-0000-0000-0000-000000000009'   -- Masters (Over 35s)
  );

UPDATE member_groups SET parent_id = '20000000-0000-0000-0000-000000000012', sort_order = 2
  WHERE id IN (
    '20000000-0000-0000-0000-000000000003',  -- Juniors Level 1
    '20000000-0000-0000-0000-000000000004',  -- Juniors Level 2
    '20000000-0000-0000-0000-000000000005',  -- Youth Development Squad
    '20000000-0000-0000-0000-000000000010'   -- Development Academy
  );

UPDATE member_groups SET parent_id = '20000000-0000-0000-0000-000000000013', sort_order = 3
  WHERE id = '20000000-0000-0000-0000-000000000006';  -- Women's Team

UPDATE member_groups SET parent_id = '20000000-0000-0000-0000-000000000014', sort_order = 4
  WHERE id IN (
    '20000000-0000-0000-0000-000000000007',  -- Mixed Social Team
    '20000000-0000-0000-0000-000000000008'   -- Coaching Staff
  );
