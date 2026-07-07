-- Resources — a tagged, hierarchical file/link library.
--
-- Clubs upload files (PDF/image/video/file) and add website/video links, organise
-- them into a folder hierarchy, and connect any folder OR resource to a person type
-- or a group so it's labelled for the right audience.
--
-- Folder audience CASCADES to everything inside it; an individual sub-folder or
-- resource can OVERRIDE with its own audience (override_targets = true).
--
-- Targets mirror the open-target-tuple pattern from registration_form_targets (229)
-- and membership_entitlements (240). Additive, no RLS — app-level org scoping.

-- Folder hierarchy
create table if not exists resource_folders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  parent_id uuid references resource_folders(id) on delete cascade,  -- null = root
  name text not null,
  override_targets boolean not null default false,  -- false = inherit parent audience
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Resources (uploaded files + external links)
create table if not exists resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  folder_id uuid references resource_folders(id) on delete cascade,  -- null = root
  kind text not null,                 -- 'pdf' | 'link' | 'video' | 'image' | 'file'
  title text not null,
  url text not null,                  -- uploaded file url OR external/embed url
  description text,
  override_targets boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz default now()
);

-- Audience targets — polymorphic owner (folder|resource) → person type | group
create table if not exists resource_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id) on delete cascade,
  owner_type text not null,           -- 'folder' | 'resource'
  owner_id uuid not null,
  target_type text not null,          -- 'group' | 'person_type'
  target_id uuid not null,            -- member_groups.id | person_target_types.id
  sort_order int default 0,
  created_at timestamptz default now(),
  unique(owner_type, owner_id, target_type, target_id)
);

create index if not exists resource_folders_org_idx on resource_folders(org_id);
create index if not exists resource_folders_parent_idx on resource_folders(parent_id);
create index if not exists resources_org_idx on resources(org_id);
create index if not exists resources_folder_idx on resources(folder_id);
create index if not exists resource_targets_owner_idx on resource_targets(org_id, owner_type, owner_id);
