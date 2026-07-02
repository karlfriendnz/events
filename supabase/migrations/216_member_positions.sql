-- Member POSITIONS (Captain, Vice-captain, Wing, …). Unlike staff roles these
-- carry NO permissions — they're just labels/positions a member holds in a group.
--
-- Catalogue lives at the CODE level (group_codes.member_positions): a code defines
-- the positions available to its groups + sub-codes. A group's available positions
-- = the UNION of its code chain's catalogues (see useGroupCodes().effectivePositions).
-- New positions can be added on the fly when adding a person (appended to the
-- group's own code).
alter table group_codes add column if not exists member_positions text[] not null default '{}';

-- A member's positions within one group (a person can hold several — e.g. Wing +
-- Captain). Distinct from member_group_memberships.roles (permission-bearing).
alter table member_group_memberships add column if not exists positions text[] not null default '{}';
