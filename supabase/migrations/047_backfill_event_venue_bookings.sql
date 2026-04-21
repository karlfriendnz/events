-- Backfill EVENT_DRIVEN bookings for events that have BOOKABLE locations
-- but no corresponding booking yet.
insert into bookings (bookable_id, event_id, type, status, start_at, end_at, purpose, is_all_day)
select
  bid.bookable_id::uuid,
  e.id,
  'EVENT_DRIVEN',
  'CONFIRMED',
  e.start_at,
  e.end_at,
  e.title,
  coalesce(e.is_all_day, false)
from events e
cross join lateral jsonb_array_elements(coalesce(e.locations, '[]'::jsonb)) as loc(entry)
cross join lateral jsonb_array_elements_text(
  coalesce(loc.entry->'bookable_ids', '[]'::jsonb)
) as bid(bookable_id)
where
  loc.entry->>'type' = 'BOOKABLE'
  and bid.bookable_id is not null
  and e.start_at is not null
  and e.end_at   is not null
  and not exists (
    select 1 from bookings b
    where b.event_id    = e.id
      and b.bookable_id = bid.bookable_id::uuid
      and b.type        = 'EVENT_DRIVEN'
      and b.status     <> 'CANCELLED'
  );
