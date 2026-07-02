-- Org-wide DEFAULT member positions (every code inherits them) + a per-code
-- MINIMUM-per-position (like role minimums). Positions carry no permissions.
--
-- default_member_positions = the org's baseline positions (Member, …) unioned
-- into every group's catalogue on top of the code-chain positions.
alter table organisations add column if not exists default_member_positions text[] not null default '{}';
-- Seed a sensible baseline so "Member" exists as a default position everywhere.
update organisations set default_member_positions = '{Member}'
  where default_member_positions = '{}' or default_member_positions is null;

-- position_minimums = { <position>: <min_count> } on a code — "each group in this
-- code should have at least N people in this position" (e.g. Wing: 2). Resolved
-- closest-wins up the code parent chain, mirroring role_minimums (migration 215).
alter table group_codes add column if not exists position_minimums jsonb not null default '{}';
