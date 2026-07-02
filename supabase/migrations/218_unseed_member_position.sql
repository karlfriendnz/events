-- "Member" is not a position — being in the group's member list already means
-- they're a member. Undo the baseline seed from migration 217 (only for orgs
-- still on the untouched seed, so any hand-added defaults are preserved).
update organisations set default_member_positions = '{}'
  where default_member_positions = '{Member}';
