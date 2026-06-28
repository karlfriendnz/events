-- North Harbour Gymnastics demo depth: trim bookings to ~50, add ~100 gymnasts
-- (ages weighted 3–10), the competitive + recreational class GROUPS (mirroring the
-- club's Classes screen) with members & coaches, and a set of events. Idempotent.

do $$
declare
  v_org uuid;
  v_dev uuid; v_s25 uuid; v_s6 uuid; v_s710 uuid; v_rec uuid; v_g uuid;
  gym_ids uuid[]; coach_ids uuid[];
  ptr int := 1; gidx int := 0; i int;
  firsts text[] := array['Amelia','Charlotte','Isla','Olivia','Sophie','Ruby','Mia','Grace','Ella','Lily',
    'Harper','Zoe','Ava','Maia','Aria','Poppy','Willow','Eva','Sienna','Hazel',
    'Jack','Oliver','William','Noah','Leo','Max','George','Theo','Henry','Liam',
    'Lucas','Mason','James','Hunter','Cooper','Finn','Eli','Archie','Hugo','Ryan'];
  lasts text[] := array['Smith','Wilson','Brown','Taylor','Patel','Nguyen','Williams','Singh','Chen','Murphy',
    'Martin','Clarke','Wood','King','Scott','Walsh','Ngata','Thompson','Lee','Robinson',
    'Harris','Wright','Walker','Young','Hall','Allen','Baker','Carter','Cooper','Evans'];
  ages int[] := array[3,3,3,4,4,4,4,5,5,5,5,5,6,6,6,6,6,7,7,7,7,8,8,8,8,9,9,9,10,10,11,12,13,14,15,16,17,18];
  genders text[] := array['FEMALE','MALE'];
  ag int;
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;
  if exists (select 1 from member_groups where org_id = v_org and name = 'Development 3.30-5.30 Tuesdays & Thursdays') then return; end if;

  -- ── Trim bookings to ~50 (keep a random spread) ──
  delete from bookings
  where bookable_id in (select id from bookables where org_id = v_org)
    and id not in (
      select id from bookings
      where bookable_id in (select id from bookables where org_id = v_org)
      order by random() limit 50
    );

  -- ── ~100 gymnasts (ages weighted to 3–10) ──
  for i in 1..100 loop
    ag := ages[1 + (i % array_length(ages, 1))];
    insert into persons (org_id, first_name, last_name, email, dob, gender, person_type, person_types)
    values (v_org,
      firsts[1 + (i % array_length(firsts, 1))],
      lasts[1 + ((i * 7) % array_length(lasts, 1))],
      'gymnast' || i || '@nhg.demo',
      (current_date - (ag * 365 + (i * 11 % 360)))::date,
      genders[1 + (i % 2)],
      'gymnast', array['gymnast']);
  end loop;

  -- a couple more coaches (Simone Francis per the screenshot)
  insert into persons (org_id, first_name, last_name, email, phone, gender, person_type, person_types) values
    (v_org, 'Simone', 'Francis', 'simone.francis@nhg.demo', '021 555 0104', 'FEMALE', 'coach', array['coach']),
    (v_org, 'Daniel', 'Cooper',  'daniel.cooper@nhg.demo',  '021 555 0105', 'MALE',   'coach', array['coach']);

  select array_agg(id order by created_at, email) into gym_ids   from persons where org_id = v_org and 'gymnast' = any(person_types);
  select array_agg(id) into coach_ids from persons where org_id = v_org and 'coach' = any(person_types);

  -- ── Group headers (parents) ──
  insert into member_groups (org_id, name, color, sort_order) values (v_org, 'Development', '#0EA5E9', 0) returning id into v_dev;
  insert into member_groups (org_id, name, color, sort_order) values (v_org, 'Step 2 - 5',  '#7C3AED', 1) returning id into v_s25;
  insert into member_groups (org_id, name, color, sort_order) values (v_org, 'Step 6',      '#16A34A', 2) returning id into v_s6;
  insert into member_groups (org_id, name, color, sort_order) values (v_org, 'Step 7 - 10', '#DB2777', 3) returning id into v_s710;
  insert into member_groups (org_id, name, color, sort_order) values (v_org, 'Recreational', '#F59E0B', 4) returning id into v_rec;

  -- helper inlined per class: create child group, assign N gymnasts + a coach.
  -- Development
  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Development 3.30-5.30 Tuesdays & Thursdays', '#0EA5E9', v_dev, 0) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+7]) pid; ptr := ptr + 8;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  -- Step 2 - 5
  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 2 - Tuesday & Thursdays 3.30-6.30', '#7C3AED', v_s25, 0) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+9]) pid; ptr := ptr + 10;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 3 - Monday, Wednesday, Friday 3.30-6.30', '#7C3AED', v_s25, 1) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+9]) pid; ptr := ptr + 10;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 4 - Tuesdays & Thursdays 4.00-8.00pm Saturday: 8-12pm', '#7C3AED', v_s25, 2) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+7]) pid; ptr := ptr + 8;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 5 - Monday and Wednesday 4.00pm-8.00pm : Sat 8-12pm', '#7C3AED', v_s25, 3) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+3]) pid; ptr := ptr + 4;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  -- Step 6
  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 6 - Monday, Wednesday, Friday 4.00-8.00', '#16A34A', v_s6, 0) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+2]) pid; ptr := ptr + 3;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 6 - Monday, Wednesday, Friday 4.00-8.00 & Saturday 11-3', '#16A34A', v_s6, 1) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+1]) pid; ptr := ptr + 2;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 6 - Optional Saturday Training 11-3.00', '#16A34A', v_s6, 2) returning id into v_g;
  -- (intentionally 0 gymnasts, matching the screenshot)

  -- Step 7 - 10
  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 7 - Mon, Wed, Friday 4.00-8.00 & Saturday 11.00-3.00', '#DB2777', v_s710, 0) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+1]) pid; ptr := ptr + 2;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 8 - Mon, Wed, Friday 4.00pm-8.00pm Saturday 11-3pm', '#DB2777', v_s710, 1) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+1]) pid; ptr := ptr + 2;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 9 - Mon, Tues, Wed, Friday 4.00-8.00pm', '#DB2777', v_s710, 2) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+2]) pid; ptr := ptr + 3;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Step 10+ - Mon, Tues, Wed, Fri 4.00-8.00', '#DB2777', v_s710, 3) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+1]) pid; ptr := ptr + 2;
  -- Simone Francis coaches Step 10+
  insert into member_group_memberships (group_id, person_id, role, roles)
    select v_g, id, 'Coach', array['coach'] from persons where org_id = v_org and email = 'simone.francis@nhg.demo' on conflict do nothing;

  -- Recreational term classes (absorb the younger gymnasts)
  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Kindy Gym - Saturday AM', '#F59E0B', v_rec, 0) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+9]) pid; ptr := ptr + 10;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Tumbling - Wednesday 4.00-5.00', '#F59E0B', v_rec, 1) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+9]) pid; ptr := ptr + 10;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Trampoline - Thursday 3.30-4.30', '#F59E0B', v_rec, 2) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+7]) pid; ptr := ptr + 8;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Parkour - Friday 4.00-5.00', '#F59E0B', v_rec, 3) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+7]) pid; ptr := ptr + 8;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  insert into member_groups (org_id, name, color, parent_id, sort_order) values (v_org, 'Gym Mix - Monday 3.30-4.30', '#F59E0B', v_rec, 4) returning id into v_g;
  insert into member_group_memberships (group_id, person_id, roles) select v_g, pid, '{}'::text[] from unnest(gym_ids[ptr:ptr+7]) pid; ptr := ptr + 8;
  insert into member_group_memberships (group_id, person_id, role, roles) values (v_g, coach_ids[1+(gidx % array_length(coach_ids,1))], 'Coach', array['coach']) on conflict do nothing; gidx := gidx + 1;

  -- ── Events ──
  insert into events (org_id, title, description, style, status, start_at, end_at) values
    (v_org, 'NHG Club Championships', 'Annual club championships across all levels.', 'SPORTS_COMPETITION', 'PUBLISHED',
      (current_date + 35 + time '09:00') at time zone 'Pacific/Auckland', (current_date + 35 + time '16:00') at time zone 'Pacific/Auckland'),
    (v_org, 'July School Holiday Programme', 'Fun-filled holiday gymnastics days.', 'HOLIDAY_PROGRAM', 'PUBLISHED',
      (current_date + 14 + time '09:00') at time zone 'Pacific/Auckland', (current_date + 14 + time '15:00') at time zone 'Pacific/Auckland'),
    (v_org, 'Parents Open Morning', 'Come and watch your gymnast in action.', 'BASIC', 'PUBLISHED',
      (current_date + 10 + time '10:00') at time zone 'Pacific/Auckland', (current_date + 10 + time '11:30') at time zone 'Pacific/Auckland'),
    (v_org, 'North Island Step Competition', 'Regional competition for Step 4+ gymnasts.', 'COMPETITION', 'PUBLISHED',
      (current_date + 48 + time '08:30') at time zone 'Pacific/Auckland', (current_date + 49 + time '17:00') at time zone 'Pacific/Auckland'),
    (v_org, 'Recreational End-of-Term Display', 'Term showcase for recreational classes.', 'BASIC', 'PUBLISHED',
      (current_date + 28 + time '17:30') at time zone 'Pacific/Auckland', (current_date + 28 + time '19:00') at time zone 'Pacific/Auckland'),
    (v_org, 'Coach Professional Development Day', 'Staff training — gyms closed to classes.', 'BASIC', 'PUBLISHED',
      (current_date + 21 + time '09:00') at time zone 'Pacific/Auckland', (current_date + 21 + time '16:00') at time zone 'Pacific/Auckland'),
    (v_org, 'Term 3 Enrolments Open', 'Enrolments open for returning and new gymnasts.', 'BASIC', 'PUBLISHED',
      (current_date + 3 + time '08:00') at time zone 'Pacific/Auckland', (current_date + 3 + time '20:00') at time zone 'Pacific/Auckland');
end $$;
