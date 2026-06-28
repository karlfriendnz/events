-- Activity ownership by a staff member.
--
-- When set, the activity belongs to a single staff (PERSON bookable) and:
--   * doesn't show up on the global Activities list (it lives on the
--     staff's profile page instead)
--   * skips UI that doesn't make sense in a coaching context (the
--     bookable picker, the bookable scope card on modes, etc.)
-- When null, the activity is a normal venue / item activity like today.

alter table activities
  add column if not exists staff_bookable_id uuid
    references bookables(id) on delete cascade;

create index if not exists activities_staff_bookable_id_idx
  on activities(staff_bookable_id)
  where staff_bookable_id is not null;
