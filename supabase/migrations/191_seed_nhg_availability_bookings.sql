-- Make North Harbour Gymnastics demo-ready: opening hours on every venue (so the
-- timetable / time-slot pickers work), Open Gym as a scheduler timetable, and a
-- calendar full of realistic bookings across the next 3 weeks. Times are stored
-- correctly for NZ (Pacific/Auckland). Idempotent — skips if bookings already exist.

do $$
declare
  v_org uuid;
  v_bday uuid; v_bday15 uuid; v_bday20 uuid;
  v_open uuid; v_open_m uuid;
  v_prog uuid; prog_modes uuid[];
  v_hol uuid; v_hol_full uuid;
  rec record;
  d date;
  cnt int := 0;
  names text[] := array['Olivia Brown','Jack Wilson','Mia Thompson','Charlotte Lee','Liam Patel',
    'Sophie Nguyen','Noah Kaur','Ava Williams','Ruby Singh','Ethan Chen','Isla Murphy','Leo Martin',
    'Grace Taylor','Max Robinson','Zoe Clarke','Harper Wood','Oscar King','Lily Scott','Hunter Walsh','Ella Ngata'];
  parents text[] := array['Sarah Brown','David Wilson','Emma Thompson','James Lee','Priya Patel',
    'Anh Nguyen','Hardeep Kaur','Michael Williams'];
  wk  jsonb := '[{"from":"09:00","to":"10:00"},{"from":"10:00","to":"11:00"},{"from":"11:00","to":"12:00"},{"from":"12:00","to":"13:00"},{"from":"13:00","to":"14:00"},{"from":"14:00","to":"15:00"},{"from":"15:00","to":"16:00"},{"from":"16:00","to":"17:00"},{"from":"17:00","to":"18:00"},{"from":"18:00","to":"19:00"},{"from":"19:00","to":"20:00"}]'::jsonb;
  we  jsonb := '[{"from":"08:00","to":"09:00"},{"from":"09:00","to":"10:00"},{"from":"10:00","to":"11:00"},{"from":"11:00","to":"12:00"},{"from":"12:00","to":"13:00"},{"from":"13:00","to":"14:00"},{"from":"14:00","to":"15:00"},{"from":"15:00","to":"16:00"},{"from":"16:00","to":"17:00"}]'::jsonb;
  cname text;
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;
  if exists (select 1 from bookings b join bookables bk on bk.id = b.bookable_id where bk.org_id = v_org) then return; end if;

  select id into v_bday   from activities where org_id = v_org and name = 'Birthday Parties';
  select id into v_bday15 from activity_modes where activity_id = v_bday and name = 'Up to 15 children';
  select id into v_bday20 from activity_modes where activity_id = v_bday and name = 'Up to 20 children';
  select id into v_open   from activities where org_id = v_org and name = 'Open Gym';
  select id into v_open_m from activity_modes where activity_id = v_open limit 1;
  select id into v_prog   from activities where org_id = v_org and name = 'Programmes';
  select array_agg(id order by sort_order) into prog_modes from activity_modes where activity_id = v_prog;
  select id into v_hol    from activities where org_id = v_org and name = 'Holiday Programme';
  select id into v_hol_full from activity_modes where activity_id = v_hol and name = 'Full day';

  -- Open Gym becomes a live timetable
  update activities set booking_flow = 'scheduler' where id = v_open;

  -- ── Opening hours per venue ──
  for rec in select id from bookables where org_id = v_org and type = 'VENUE' loop
    insert into availability_rules (bookable_id, name, rule_type, days_of_week, time_slots, is_active, sort_order) values
      (rec.id, 'Weekday hours', 'OPEN', '{1,2,3,4,5}', wk, true, 0),
      (rec.id, 'Weekend hours', 'OPEN', '{0,6}',       we, true, 1);
  end loop;

  -- ── Bookings across the next 3 weeks, per venue ──
  for rec in select id, name from bookables where org_id = v_org and type = 'VENUE' loop
    d := current_date;
    while d <= current_date + 20 loop
      cnt := cnt + 1;
      cname := names[1 + (cnt % array_length(names, 1))];

      if extract(dow from d) in (0, 6) then
        -- weekend: two birthday parties + a morning open-gym block
        insert into bookings (bookable_id, activity_id, activity_mode_id, type, status, start_at, end_at, contact_name, contact_email, contact_phone, notes) values
          (rec.id, v_bday, v_bday15, 'ONE_OFF', 'CONFIRMED', (d + time '10:00') at time zone 'Pacific/Auckland', (d + time '11:45') at time zone 'Pacific/Auckland',
            parents[1 + (cnt % array_length(parents, 1))], 'party' || cnt || '@nhg.demo', '021 555 ' || lpad(cnt::text, 4, '0'), 'Birthday party'),
          (rec.id, v_bday, v_bday20, 'ONE_OFF', 'CONFIRMED', (d + time '14:00') at time zone 'Pacific/Auckland', (d + time '15:45') at time zone 'Pacific/Auckland',
            parents[1 + ((cnt + 3) % array_length(parents, 1))], 'party' || cnt || 'b@nhg.demo', '021 556 ' || lpad(cnt::text, 4, '0'), 'Birthday party'),
          (rec.id, v_open, v_open_m, 'ONE_OFF', 'CONFIRMED', (d + time '09:00') at time zone 'Pacific/Auckland', (d + time '10:00') at time zone 'Pacific/Auckland',
            cname, 'opengym' || cnt || '@nhg.demo', '027 555 ' || lpad(cnt::text, 4, '0'), 'Open gym');
      else
        -- weekday: two after-school programme classes + an open-gym session
        insert into bookings (bookable_id, activity_id, activity_mode_id, type, status, start_at, end_at, contact_name, contact_email, contact_phone, notes) values
          (rec.id, v_prog, prog_modes[1 + (cnt % array_length(prog_modes, 1))], 'ONE_OFF', 'CONFIRMED', (d + time '15:30') at time zone 'Pacific/Auckland', (d + time '16:30') at time zone 'Pacific/Auckland',
            cname, 'prog' || cnt || '@nhg.demo', '021 557 ' || lpad(cnt::text, 4, '0'), 'Programme class'),
          (rec.id, v_prog, prog_modes[1 + ((cnt + 2) % array_length(prog_modes, 1))], 'ONE_OFF', 'CONFIRMED', (d + time '16:30') at time zone 'Pacific/Auckland', (d + time '17:30') at time zone 'Pacific/Auckland',
            names[1 + ((cnt + 5) % array_length(names, 1))], 'prog' || cnt || 'b@nhg.demo', '021 558 ' || lpad(cnt::text, 4, '0'), 'Programme class'),
          (rec.id, v_open, v_open_m, 'ONE_OFF', 'CONFIRMED', (d + time '10:00') at time zone 'Pacific/Auckland', (d + time '11:00') at time zone 'Pacific/Auckland',
            names[1 + ((cnt + 8) % array_length(names, 1))], 'opengym' || cnt || '@nhg.demo', '027 556 ' || lpad(cnt::text, 4, '0'), 'Open gym');

        -- school-holiday full-day sessions for the first week (looks busy + varied)
        if d <= current_date + 6 then
          insert into bookings (bookable_id, activity_id, activity_mode_id, type, status, start_at, end_at, contact_name, contact_email, contact_phone, notes) values
            (rec.id, v_hol, v_hol_full, 'ONE_OFF', 'CONFIRMED', (d + time '09:00') at time zone 'Pacific/Auckland', (d + time '15:00') at time zone 'Pacific/Auckland',
              names[1 + ((cnt + 11) % array_length(names, 1))], 'holiday' || cnt || '@nhg.demo', '027 557 ' || lpad(cnt::text, 4, '0'), 'Holiday programme');
        end if;
      end if;

      d := d + 1;
    end loop;
  end loop;
end $$;
