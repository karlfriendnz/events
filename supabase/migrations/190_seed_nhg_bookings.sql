-- Seed North Harbour Gymnastics' booking engine, mirroring their real "Resources"
-- menu (Birthday Parties, Specialty Bookings, School Programmes, Holiday Programme,
-- School Competitions) + Open Gym, programme enrolment, and facility/room hire.
-- THREE venues (HBC, Albany, Eventfinda Stadium), each with a Gym Floor + Party
-- Room for hire. Insert shapes mirror pages/dev/seed-items.vue. Idempotent.

do $$
declare
  v_org uuid; v_hbc uuid; v_alb uuid; v_efs uuid; v_act uuid; v uuid;
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;
  if exists (select 1 from activities where org_id = v_org and name = 'Birthday Parties') then return; end if;

  -- ── Three venues ──
  insert into bookables (org_id, name, type, status, max_concurrent, is_public, allow_sub_venues)
    values (v_org, 'HBC (Hibiscus Coast)', 'VENUE', 'ACTIVE', 60, true, true) returning id into v_hbc;
  insert into bookables (org_id, name, type, status, max_concurrent, is_public, allow_sub_venues)
    values (v_org, 'Albany', 'VENUE', 'ACTIVE', 60, true, true) returning id into v_alb;
  insert into bookables (org_id, name, type, status, max_concurrent, is_public, allow_sub_venues)
    values (v_org, 'Eventfinda Stadium', 'VENUE', 'ACTIVE', 80, true, true) returning id into v_efs;

  -- ── Hireable spaces under each venue (Gym Floor + Party Room) ──
  foreach v in array array[v_hbc, v_alb, v_efs] loop
    insert into bookables (org_id, name, type, status, max_concurrent, is_public, parent_id)
      values (v_org, 'Gym Floor', 'ITEM', 'ACTIVE', 1, true, v);
    insert into bookables (org_id, name, type, status, max_concurrent, is_public, parent_id)
      values (v_org, 'Party Room', 'ITEM', 'ACTIVE', 2, true, v);
  end loop;

  -- helper: link an activity to all three venues
  -- (inlined below since PL/pgSQL has no closures)

  -- ── Birthday Parties (matches site pricing) ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, color, icon, area_name_singular, area_name_plural)
    values (v_org, 'Birthday Parties', 'ACTIVE', true, 'wizard', true, '#E11D48', 'pi-gift', 'Party', 'Parties') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id) values (v_act, v_hbc), (v_act, v_alb), (v_act, v_efs);
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Up to 15 children', 'hour', 1, 'fixed', 345, 'Birthday Parties', 0),
    (v_act, 'Up to 20 children', 'hour', 1, 'fixed', 395, 'Birthday Parties', 1);

  -- ── Open Gym (casual drop-in) ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, color, icon)
    values (v_org, 'Open Gym', 'ACTIVE', true, 'wizard', true, '#0EA5E9', 'pi-bolt') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id) values (v_act, v_hbc), (v_act, v_alb), (v_act, v_efs);
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Casual drop-in', 'hour', 1, 'fixed', 12, 'Open Gym', 0);

  -- ── Programmes (class / programme enrolment, per term) ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, color, icon)
    values (v_org, 'Programmes', 'ACTIVE', true, 'wizard', true, '#7C3AED', 'pi-calendar') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id) values (v_act, v_hbc), (v_act, v_alb), (v_act, v_efs);
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Kindy',      'month', 3, 'fixed', 180, 'Programmes', 0),
    (v_act, 'Tumbling',   'month', 3, 'fixed', 195, 'Programmes', 1),
    (v_act, 'Trampoline', 'month', 3, 'fixed', 195, 'Programmes', 2),
    (v_act, 'Parkour',    'month', 3, 'fixed', 195, 'Programmes', 3),
    (v_act, 'Gym Mix',    'month', 3, 'fixed', 185, 'Programmes', 4),
    (v_act, 'Rhythmic',   'month', 3, 'fixed', 195, 'Programmes', 5);

  -- ── Facility & Room Hire (item flow — pick gym floor or party room at any site) ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, assignment_mode, color, icon, area_name_singular, area_name_plural)
    values (v_org, 'Facility & Room Hire', 'ACTIVE', true, 'item', true, 'either', '#0D9488', 'pi-building', 'Space', 'Spaces') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id)
    select v_act, b.id from bookables b where b.org_id = v_org and b.type = 'ITEM' and b.name in ('Gym Floor', 'Party Room');
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Hourly hire', 'hour', 1, 'fixed', 80, 'Facility hire', 0);

  -- ── Specialty Bookings ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, color, icon)
    values (v_org, 'Specialty Bookings', 'ACTIVE', true, 'wizard', true, '#F59E0B', 'pi-star') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id) values (v_act, v_hbc), (v_act, v_alb), (v_act, v_efs);
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Specialty session', 'hour', 1, 'fixed', 150, 'Specialty Bookings', 0);

  -- ── School Programmes ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, color, icon)
    values (v_org, 'School Programmes', 'ACTIVE', true, 'wizard', true, '#2563EB', 'pi-briefcase') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id) values (v_act, v_hbc), (v_act, v_alb), (v_act, v_efs);
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Class visit (per session)', 'hour', 1, 'fixed', 250, 'School Programmes', 0);

  -- ── Holiday Programme ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, color, icon)
    values (v_org, 'Holiday Programme', 'ACTIVE', true, 'wizard', true, '#16A34A', 'pi-sun') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id) values (v_act, v_hbc), (v_act, v_alb), (v_act, v_efs);
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Full day', 'day', 1, 'fixed', 65, 'Holiday Programme', 0),
    (v_act, 'Half day', 'hour', 4, 'fixed', 40, 'Holiday Programme', 1);

  -- ── School Competitions ──
  insert into activities (org_id, name, status, bookings_enabled, booking_flow, require_mode, color, icon)
    values (v_org, 'School Competitions', 'ACTIVE', true, 'wizard', true, '#DB2777', 'pi-flag') returning id into v_act;
  insert into activity_bookables (activity_id, bookable_id) values (v_act, v_hbc), (v_act, v_alb), (v_act, v_efs);
  insert into activity_modes (activity_id, name, period_unit, period_count, term_type, period_price, category, sort_order) values
    (v_act, 'Competition entry (per gymnast)', 'hour', 1, 'fixed', 20, 'School Competitions', 0);
end $$;
