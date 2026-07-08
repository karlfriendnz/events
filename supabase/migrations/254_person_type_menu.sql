-- Per-person-type LEFT-MENU configuration. A club can choose exactly which
-- left-menu items each person type (Parent, Member, Coach…) sees — e.g. a Parent
-- sees Dashboard + Events + Fees but not People/Settings. Stored as an array of
-- menu-item keys (the item's href, the stable key). NULL = fall back to the
-- permission-driven default (show an item when the type can read its resource).
alter table person_target_types add column if not exists menu_items jsonb;

comment on column person_target_types.menu_items is
  'Array of club-menu item keys (href) this type sees in the left nav. NULL = derive from permissions.';
