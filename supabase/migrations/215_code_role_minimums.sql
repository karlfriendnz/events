-- Per-code minimum staff per role. For each staff role, a code can say "every
-- group in this code should have at least N people in this role".
--
-- role_minimums = { <role_key>: <min_count> } on the code. A group resolves the
-- CLOSEST value: walk the code parent chain from the group's code upward and use
-- the first code that sets a minimum for that role (so a child code's 1 overrides
-- a parent code's 2). See useGroupCodes().effectiveRoleMins().
alter table group_codes add column if not exists role_minimums jsonb not null default '{}';
