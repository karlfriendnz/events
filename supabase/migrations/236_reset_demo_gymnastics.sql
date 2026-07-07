-- RESET TO ONE GYMNASTICS HIERARCHY (7 Jul 2026, per Karl).
-- Wipes EVERY organisation + all org data, keeping only master data (brands,
-- club_types, sport_categories, help_articles, core permission templates),
-- then seeds a single gymnastics chain exercising the new features:
-- sport-scoped terminology (233), term sets + sport link (232/235), sign-up
-- windows (230), codes w/ role minimums + code staff (213-215), fees w/ line
-- items + due/deposit (204/225) + a FREE class, waitlists (221-223), circles,
-- GNZ-inherited fields, and two club events.
-- On a fresh replay this simply reseeds (auth.users lookups no-op when empty).
do $$
declare
  r record;
  v_gnz uuid; v_region uuid; v_club uuid; v_club2 uuid;
  v_sport uuid; v_adults uuid; v_t3 uuid;
  v_code_rec uuid; v_code_dev uuid; v_code_comp uuid;
  v_opt uuid; v_wl uuid; v_fam uuid;
  v_gid uuid; v_pid uuid;
  class_ids uuid[] := '{}';
  gym_ids uuid[] := '{}';
  staff_ids uuid[] := '{}';
  parent_ids uuid[] := '{}';
  firsts text[] := array['Aria','Bella','Carter','Daisy','Eli','Freya','George','Harper','Isla','Jack','Kora','Liam','Mila','Noah','Olive','Pippa','Quinn','Ruby','Sonny','Thea','Uma','Violet','Willow','Xavier','Yasmin','Zoe','Ava','Beau','Cleo','Dexter','Esme','Finn','Greta','Hugo','Ivy','Jonah','Keira','Louis','Maeve','Nina'];
  lasts text[] := array['Sharma','Walker','Ng','Taylor','Rangi','Patel','Clarke','Kaur','Morgan','Fox'];
  i int; k int; g int := 1; take int;
  cls record;
begin
  set local session_replication_role = replica;

  -- ── WIPE (keep master data + core permission templates) ──
  for r in select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE' loop
    if r.table_name in ('brands', 'club_types', 'sport_categories', 'help_articles') then
      continue;
    elsif r.table_name = 'permission_groups' then
      delete from permission_groups where org_id is not null;
    else
      execute format('delete from %I', r.table_name);
    end if;
  end loop;

  -- ── Hierarchy: GNZ → Gymnastics Auckland → clubs ──
  insert into organisations (name, type, org_level, slug, currency, locale, default_sport_name)
    values ('Gymnastics New Zealand', 'NSO', 'NATIONAL', 'gymnastics-nz', 'NZD', 'en-NZ', 'Gymnastics') returning id into v_gnz;
  insert into organisations (name, type, org_level, slug, currency, locale, parent_id, default_sport_name)
    values ('Gymnastics Auckland', 'NSO', 'REGIONAL', 'gymnastics-auckland', 'NZD', 'en-NZ', v_gnz, 'Gymnastics') returning id into v_region;
  insert into organisations (name, type, org_level, slug, currency, locale, parent_id, season_start, season_end)
    values ('North Harbour Gymnastics', 'CLUB', 'CLUB', 'north-harbour-gymnastics', 'NZD', 'en-NZ', v_region, '2026-07-01', '2026-12-20') returning id into v_club;
  insert into organisations (name, type, org_level, slug, currency, locale, parent_id)
    values ('West Auckland Gymnastics', 'CLUB', 'CLUB', 'west-auckland-gymnastics', 'NZD', 'en-NZ', v_region) returning id into v_club2;

  -- ── Sport rows + SPORT-SCOPED TERMINOLOGY ──
  insert into org_sports (org_id, sport, nso_org_id, is_primary, sort_order, terminology)
    values (v_club, 'Gymnastics', v_gnz, true, 0,
      '{"member":{"singular":"Gymnast","plural":"Gymnasts"},"group":{"singular":"Class","plural":"Classes"},"code":{"singular":"Programme","plural":"Programmes"},"term":{"singular":"Season","plural":"Seasons"}}'::jsonb)
    returning id into v_sport;
  insert into org_sports (org_id, sport, nso_org_id, is_primary, sort_order)
    values (v_club2, 'Gymnastics', v_gnz, true, 0);

  -- ── GNZ disciplines + an inherited national field ──
  insert into disciplines (org_id, name, sport, sort_order) values
    (v_gnz, 'Women''s Artistic', 'Gymnastics', 0),
    (v_gnz, 'Men''s Artistic', 'Gymnastics', 1),
    (v_gnz, 'Rhythmic', 'Gymnastics', 2),
    (v_gnz, 'Trampoline', 'Gymnastics', 3);
  insert into field_definitions (org_id, label, field_type, is_required, targets, target, sort_order)
    values (v_gnz, 'GNZ Number', 'text', false, array['gymnast'], 'gymnast', 0);

  -- ── Club person types + custom fields ──
  insert into person_target_types (org_id, key, label, kind, is_access, min_count, max_count, sort_order, member_slots) values
    (v_club, 'gymnast',           'Gymnast',           'person', false, 0, null, 0, '[]'::jsonb),
    (v_club, 'parent',            'Parent',            'person', false, 0, null, 1, '[]'::jsonb),
    (v_club, 'emergency_contact', 'Emergency contact', 'person', false, 0, null, 2, '[]'::jsonb),
    (v_club, 'coach',             'Coach',             'person', true,  0, null, 3, '[]'::jsonb),
    (v_club, 'manager',           'Manager',           'person', true,  0, null, 4, '[]'::jsonb),
    (v_club, 'admin',             'Admin',             'person', true,  0, null, 5, '[]'::jsonb);
  insert into field_definitions (org_id, label, field_type, options, is_required, targets, target, sort_order) values
    (v_club, 'Gymnastics level', 'select', '["Kindy","Recreational","Development","Competitive"]'::jsonb, false, array['gymnast'], 'gymnast', 0),
    (v_club, 'Medical notes', 'textarea', '[]'::jsonb, false, array['gymnast'], 'gymnast', 1);

  -- ── Terms: main sequence + Adults term set tied to the sport ──
  insert into term_sets (org_id, name, sport_id, sort_order) values (v_club, 'Adults', v_sport, 0) returning id into v_adults;
  insert into org_terms (org_id, name, start_date, end_date, signup_open, signup_close, status, sort_order)
    values (v_club, 'Term 3 2026', '2026-07-20', '2026-09-25', '2026-07-06', '2026-09-20', 'active', 0) returning id into v_t3;
  insert into org_terms (org_id, name, start_date, end_date, signup_open, status, sort_order)
    values (v_club, 'Term 4 2026', '2026-10-12', '2026-12-18', '2026-09-28', 'active', 1);
  insert into org_terms (org_id, name, start_date, end_date, set_id, status, sort_order)
    values (v_club, 'Second Half 2026', '2026-07-06', '2026-12-18', v_adults, 'active', 2);

  -- ── Programmes (codes) ──
  insert into group_codes (org_id, name, color, sort_order, member_type_key)
    values (v_club, 'Recreational', '#F59E0B', 0, 'gymnast') returning id into v_code_rec;
  insert into group_codes (org_id, name, color, sort_order, member_type_key)
    values (v_club, 'Development', '#0EA5E9', 1, 'gymnast') returning id into v_code_dev;
  insert into group_codes (org_id, name, color, sort_order, member_type_key, role_minimums, member_positions)
    values (v_club, 'Competitive', '#DB2777', 2, 'gymnast', '{"coach":2}'::jsonb, array['Captain']) returning id into v_code_comp;

  -- ── Classes (Term 3) ──
  for cls in select * from (values
    ('Kindy Gym',          v_code_rec,  '#FBBF24', 12, '2-4',  null::text, 1, '09:30'::time, '10:15'::time),
    ('Mini Movers',        v_code_rec,  '#F59E0B', 14, '4-6',  null, 2, '15:30', '16:30'),
    ('Rec Level 1',        v_code_rec,  '#F97316', 16, '6-9',  null, 3, '16:00', '17:00'),
    ('Rec Level 2',        v_code_rec,  '#EA580C', 16, '8-12', null, 3, '17:30', '18:30'),
    ('Development Squad A', v_code_dev, '#0EA5E9', 10, '7-10', null, 1, '16:00', '18:00'),
    ('Development Squad B', v_code_dev, '#0284C7', 10, '9-12', null, 2, '16:00', '18:00'),
    ('WAG Step 4',         v_code_comp, '#DB2777', 8,  '9-13', 'FEMALE', 1, '15:30', '18:30'),
    ('WAG Step 5',         v_code_comp, '#BE185D', 8,  '10-14','FEMALE', 2, '15:30', '18:30'),
    ('Trampoline Squad',   v_code_comp, '#9D174D', 12, '8+',   null, 6, '09:00', '11:00')
  ) as t(nm, code_id, col, cap, age, gnd, dow, st, en) loop
    insert into member_groups (org_id, name, color, code_id, term_id, capacity, age_range, gender_restriction, sort_order)
      values (v_club, cls.nm, cls.col, cls.code_id, v_t3, cls.cap, cls.age, cls.gnd, coalesce(array_length(class_ids, 1), 0))
      returning id into v_gid;
    update member_groups set lineage_id = id where id = v_gid;
    insert into member_group_schedules (org_id, group_id, day_of_week, start_time, end_time, sort_order)
      values (v_club, v_gid, cls.dow, cls.st, cls.en, 0);
    -- squads train twice a week
    if cls.code_id in (v_code_dev, v_code_comp) and cls.nm <> 'Trampoline Squad' then
      insert into member_group_schedules (org_id, group_id, day_of_week, start_time, end_time, sort_order)
        values (v_club, v_gid, least(cls.dow + 3, 5), cls.st, cls.en, 1);
    end if;
    class_ids := class_ids || v_gid;
  end loop;

  -- ── Fees: line items + Xero codes; Kindy Gym stays FREE ──
  for i in 2..array_length(class_ids, 1) loop   -- skip 1 = Kindy Gym (free class)
    insert into group_fee_options (org_id, group_id, name, fee_type, sort_order, due_date, deposit_percent)
      values (v_club, class_ids[i], 'Season fee', 'upfront', 0,
        case when i >= 7 then '2026-07-31'::date else null end,
        case when i >= 7 then 25 else null end)
      returning id into v_opt;
    insert into group_fee_option_items (option_id, name, amount, account, sort_order) values
      (v_opt, 'Tuition', case when i >= 7 then 350 else 185 end, '200', 0),
      (v_opt, 'GNZ affiliation', 45, '210', 1);
    if i = 3 then  -- Rec Level 1: extra concession option
      insert into group_fee_options (org_id, group_id, name, fee_type, session_count, sort_order)
        values (v_club, class_ids[i], '10-session concession', 'concession', 10, 1) returning id into v_opt;
      insert into group_fee_option_items (option_id, name, amount, account, sort_order)
        values (v_opt, 'Concession card', 180, '200', 0);
    end if;
  end loop;

  -- ── People ──
  for i in 1..40 loop
    insert into persons (org_id, first_name, last_name, email, dob, gender, person_type, person_types, custom_fields)
      values (v_club, firsts[i], lasts[((i - 1) % 10) + 1],
        lower(firsts[i]) || '.' || lower(lasts[((i - 1) % 10) + 1]) || '@nhg.demo',
        make_date(2012 + (i % 10), ((i - 1) % 9) + 1, ((i - 1) % 9) + 10),
        case when i % 2 = 0 then 'FEMALE' else 'MALE' end,
        'gymnast', array['gymnast'], '{}'::jsonb)
      returning id into v_pid;
    gym_ids := gym_ids || v_pid;
  end loop;
  for r in select * from (values
    ('Sarah','Wright','coach'), ('Tom','Singh','coach'), ('Emma','Lopez','coach'),
    ('Jade','Kingi','coach'), ('Marcus','Bell','manager'), ('Priya','Nair','admin')
  ) as t(fn, ln, role) loop
    insert into persons (org_id, first_name, last_name, email, phone, person_type, person_types)
      values (v_club, r.fn, r.ln, lower(r.fn) || '.' || lower(r.ln) || '@nhg.demo', '021 000 000', r.role, array[r.role])
      returning id into v_pid;
    staff_ids := staff_ids || v_pid;
  end loop;
  for r in select * from (values ('Anita','Sharma'), ('Raj','Sharma'), ('Kim','Walker'), ('Sam','Ng')) as t(fn, ln) loop
    insert into persons (org_id, first_name, last_name, email, phone, person_type, person_types)
      values (v_club, r.fn, r.ln, lower(r.fn) || '.' || lower(r.ln) || '@nhg.demo', '021 111 111', 'parent', array['parent'])
      returning id into v_pid;
    parent_ids := parent_ids || v_pid;
  end loop;

  -- ── Memberships: gymnasts spread across classes + a coach each ──
  for i in 1..array_length(class_ids, 1) loop
    take := (array[5,5,6,5,4,4,4,3,4])[i];
    for k in 1..take loop
      exit when g > array_length(gym_ids, 1);
      insert into member_group_memberships (group_id, person_id, term_id) values (class_ids[i], gym_ids[g], v_t3);
      g := g + 1;
    end loop;
    insert into member_group_memberships (group_id, person_id, role, roles, term_id)
      values (class_ids[i], staff_ids[((i - 1) % 4) + 1], 'Coach', array['coach'], v_t3);
  end loop;
  -- second coach on WAG Step 4 (Competitive minimum is 2 — Step 5 shows a vacancy)
  insert into member_group_memberships (group_id, person_id, role, roles, term_id)
    values (class_ids[7], staff_ids[4], 'Coach', array['coach'], v_t3);

  -- ── Code-level staff: the manager runs the Competitive programme ──
  insert into code_staff (org_id, code_lineage_id, person_id, role_key)
    values (v_club, v_code_comp, staff_ids[5], 'manager');

  -- ── Waitlist: Rec Levels 1 & 2 share one queue ──
  insert into waitlists (org_id, name, term_id, order_mode) values (v_club, 'Rec Levels 1 & 2', v_t3, 'fifo') returning id into v_wl;
  update waitlists set lineage_id = id where id = v_wl;
  update member_groups set waitlist_id = v_wl where id in (class_ids[3], class_ids[4]);
  for i in 38..40 loop
    insert into waitlist_entries (org_id, waitlist_id, person_id, status, sort_order) values (v_club, v_wl, gym_ids[i], 'waiting', i - 38);
  end loop;

  -- ── Circles: one family ──
  insert into circles (org_id, name, kind) values (v_club, 'Sharma Family', 'family') returning id into v_fam;
  insert into circle_members (circle_id, person_id, role, relationship, contact_type, receives_comms, can_book_for, can_view, is_primary) values
    (v_fam, parent_ids[1], 'guardian', 'Mum', 'primary', true, true, true, true),
    (v_fam, parent_ids[2], 'guardian', 'Dad', 'standard', true, true, true, false),
    (v_fam, gym_ids[1], 'dependent', null, null, false, false, false, false),
    (v_fam, gym_ids[11], 'dependent', null, null, false, false, false, false);

  -- ── Club events ──
  insert into events (org_id, title, description, style, status, start_at, end_at) values
    (v_club, 'NHG Club Championships', 'Annual club championships across all levels.', 'SPORTS_COMPETITION', 'PUBLISHED',
      '2026-09-12 09:00+12', '2026-09-12 16:00+12'),
    (v_club, 'Term 3 Display Day', 'Every class shows what they''ve learned this season.', 'BASIC', 'PUBLISHED',
      '2026-09-24 17:00+12', '2026-09-24 19:00+12');

  -- ── Logins: link karl + superadmin to the club ──
  for r in select id from auth.users where email in ('karl@getfrello.com', 'superadmin@friendlymanager.com') loop
    insert into org_members (user_id, org_id) values (r.id, v_club);
  end loop;
end $$;
