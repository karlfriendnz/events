-- SEED: a MULTI-SPORT club (17 Jul 2026, per Karl).
--
-- Why this exists: every demo club so far runs ONE sport, and a one-sport club
-- cannot show the thing we need to see. Its single sport's governing body IS its
-- organisations.parent_id, so walking parents and walking sport affiliations
-- return the same answer and any bug in the difference is invisible.
--
-- Harbourside Racquets runs FOUR sports under four separate national bodies. It
-- has one parent_id (Tennis NZ — the primary sport, mirrored there by
-- OrgSportsEditor), so Badminton/Squash/Pickleball NZ are reachable ONLY through
-- org_sports → org_sport_ancestors. Before useOrgHierarchy.governingOrgs, that
-- meant resolveFields surfaced Tennis NZ's field and silently hid the other three.
--
-- ADDITIVE — wipes nothing. The gymnastics hierarchy from 236 stays as the
-- single-sport control case. Idempotent: guarded on the club slug.
--
-- What it exercises:
--   • 4 sport affiliations on one club, only one of them the parent_id (148/149)
--   • a national field per body, each targeting the SAME 'player' key (169)
--   • a discipline per body + a requirement demanding that body's field (266/268)
--   • programmes carrying sport_id (238) → each class derives its sport
--   • one person in all four sports, and others in only one or two
do $$
declare
  v_tennis uuid; v_badminton uuid; v_squash uuid; v_pickleball uuid; v_club uuid;
  v_sp_tennis uuid; v_sp_badminton uuid; v_sp_squash uuid; v_sp_pickleball uuid;
  v_t3 uuid;
  v_fld uuid; v_disc uuid; v_code uuid; v_gid uuid; v_pid uuid;
  v_coach uuid;
  r record;
  v_i int;
  v_all uuid[] := '{}';   -- the four classes, in sport order
begin
  if exists (select 1 from organisations where slug = 'harbourside-racquets') then
    raise notice '270: harbourside-racquets already seeded — skipping';
    return;
  end if;

  -- ── Four national bodies ──
  insert into organisations (name, type, org_level, slug, currency, locale, default_sport_name)
    values ('Tennis New Zealand', 'NSO', 'NATIONAL', 'tennis-nz', 'NZD', 'en-NZ', 'Tennis') returning id into v_tennis;
  insert into organisations (name, type, org_level, slug, currency, locale, default_sport_name)
    values ('Badminton New Zealand', 'NSO', 'NATIONAL', 'badminton-nz', 'NZD', 'en-NZ', 'Badminton') returning id into v_badminton;
  insert into organisations (name, type, org_level, slug, currency, locale, default_sport_name)
    values ('Squash New Zealand', 'NSO', 'NATIONAL', 'squash-nz', 'NZD', 'en-NZ', 'Squash') returning id into v_squash;
  insert into organisations (name, type, org_level, slug, currency, locale, default_sport_name)
    values ('Pickleball New Zealand', 'NSO', 'NATIONAL', 'pickleball-nz', 'NZD', 'en-NZ', 'Pickleball') returning id into v_pickleball;

  -- ── The club. parent_id = Tennis NZ ONLY — the primary sport's body. The other
  --    three affiliations exist solely as org_sports rows, which is the whole point.
  insert into organisations (name, type, org_level, slug, currency, locale, parent_id, season_start, season_end)
    values ('Harbourside Racquets Club', 'CLUB', 'CLUB', 'harbourside-racquets', 'NZD', 'en-NZ',
            v_tennis, '2026-07-01', '2026-12-20')
    returning id into v_club;

  insert into org_sports (org_id, sport, nso_org_id, is_primary, sort_order)
    values (v_club, 'Tennis', v_tennis, true, 0) returning id into v_sp_tennis;
  insert into org_sports (org_id, sport, nso_org_id, is_primary, sort_order)
    values (v_club, 'Badminton', v_badminton, false, 1) returning id into v_sp_badminton;
  insert into org_sports (org_id, sport, nso_org_id, is_primary, sort_order)
    values (v_club, 'Squash', v_squash, false, 2) returning id into v_sp_squash;
  insert into org_sports (org_id, sport, nso_org_id, is_primary, sort_order)
    values (v_club, 'Pickleball', v_pickleball, false, 3) returning id into v_sp_pickleball;

  -- ── Club person types ──
  -- NB 'player' matches the key every national field targets below. That is the
  -- CURRENT connection mechanism: lower-cased string equality, nothing more. Rename
  -- this label to "Member" (key 'member') and all four bodies' fields silently stop
  -- applying, with no error — which is what the club-type ↔ NSO-type link must fix.
  --
  -- Deliberately NO person_target_types rows on the four bodies. resolvePersonTypes
  -- walks ancestors and does NOT dedupe by key, so an NSO 'player' row would render
  -- "Player" twice in all 10 of its callers' pickers. Fields target a key STRING and
  -- need no type row to flow (236 does the same: GNZ targets 'gymnast', owns no type).
  insert into person_target_types (org_id, key, label, kind, is_access, min_count, max_count, sort_order, member_slots) values
    (v_club, 'player', 'Player', 'person', false, 0, null, 0, '[]'::jsonb),
    (v_club, 'coach',  'Coach',  'person', true,  0, null, 1, '[]'::jsonb),
    (v_club, 'admin',  'Admin',  'person', true,  0, null, 2, '[]'::jsonb);

  insert into field_definitions (org_id, label, field_type, options, is_required, targets, target, sort_order)
    values (v_club, 'Locker number', 'text', '[]'::jsonb, false, array['player'], 'player', 0);

  -- ── Per body: a national field + a discipline + a requirement demanding it ──
  -- Each field targets 'player'. Each requirement says "this must be recorded"
  -- (operator 'Is Not Empty' → purpose 'data'), scoped to players.
  for r in select * from (values
    (0, 'Tennis',     'Tennis NZ ID',      'text',   '[]',                          'Club Tennis'),
    (1, 'Badminton',  'Badminton NZ ID',   'text',   '[]',                          'Club Badminton'),
    (2, 'Squash',     'Squash NZ Grading', 'select', '["A","B","C","D"]',           'Club Squash'),
    (3, 'Pickleball', 'DUPR Rating',       'text',   '[]',                          'Club Pickleball')
  ) as t(idx, sport, fld, ftype, opts, disc) loop
    insert into field_definitions (org_id, label, field_type, options, is_required, targets, target, sort_order)
      values ((array[v_tennis, v_badminton, v_squash, v_pickleball])[r.idx + 1],
              r.fld, r.ftype, r.opts::jsonb, false, array['player'], 'player', 0)
      returning id into v_fld;

    insert into disciplines (org_id, name, sport, sort_order, applies_to)
      values ((array[v_tennis, v_badminton, v_squash, v_pickleball])[r.idx + 1],
              r.disc, r.sport, 0, array['group'])
      returning id into v_disc;

    insert into discipline_requirements
      (discipline_id, field_definition_id, purpose, operator, applies_to, sort_order)
      values (v_disc, v_fld, 'data', 'Is Not Empty', array['player'], 0);

    -- Programme carrying its sport (238) → every class under it derives (sport).
    insert into group_codes (org_id, name, color, sort_order, member_type_key, sport_id)
      values (v_club, r.sport,
              (array['#16A34A', '#7C3AED', '#DC2626', '#0891B2'])[r.idx + 1],
              r.idx, 'player',
              (array[v_sp_tennis, v_sp_badminton, v_sp_squash, v_sp_pickleball])[r.idx + 1])
      returning id into v_code;

    insert into member_groups (org_id, name, color, code_id, capacity, age_range, sort_order)
      values (v_club,
              (array['Tennis Club Night', 'Badminton Club Night', 'Squash Box League', 'Pickleball Social'])[r.idx + 1],
              (array['#16A34A', '#7C3AED', '#DC2626', '#0891B2'])[r.idx + 1],
              v_code, 16, '16+', r.idx)
      returning id into v_gid;
    update member_groups set lineage_id = id where id = v_gid;

    -- The class ↔ discipline link: this is what carries the body's requirement
    -- onto everyone on the roster.
    insert into member_group_disciplines (group_id, discipline_id) values (v_gid, v_disc);

    insert into member_group_schedules (org_id, group_id, day_of_week, start_time, end_time, sort_order)
      values (v_club, v_gid, r.idx + 1, '18:00'::time, '20:00'::time, 0);

    v_all := v_all || v_gid;
  end loop;

  -- ── Term (created after the codes so nothing depends on ordering) ──
  insert into org_terms (org_id, name, start_date, end_date, signup_open, signup_close, status, sort_order)
    values (v_club, 'Term 3 2026', '2026-07-20', '2026-09-25', '2026-07-06', '2026-09-20', 'active', 0)
    returning id into v_t3;
  update member_groups set term_id = v_t3 where org_id = v_club;

  -- ── A coach across the club ──
  insert into persons (org_id, first_name, last_name, email, phone, person_type, person_types)
    values (v_club, 'Dan', 'Whitiora', 'dan.whitiora@harbourside.demo', '021 555 000', 'coach', array['coach'])
    returning id into v_coach;

  -- ── Players ──
  -- Alex is the case that motivated all of this: ONE person, ONE Player type,
  -- plays all four sports, so all four bodies have a claim on their profile.
  insert into persons (org_id, first_name, last_name, email, phone, dob, gender, person_type, person_types, custom_fields)
    values (v_club, 'Alex', 'Rivera', 'alex.rivera@harbourside.demo', '021 555 111',
            '1994-03-12', 'NON_BINARY', 'player', array['player'], '{}'::jsonb)
    returning id into v_pid;
  for v_i in 1..array_length(v_all, 1) loop
    insert into member_group_memberships (group_id, person_id, term_id) values (v_all[v_i], v_pid, v_t3);
  end loop;

  -- Single- and dual-sport players — the control for per-person scoping. Priya
  -- must never be asked for a Squash NZ Grading.
  for r in select * from (values
    ('Priya', 'Naidu',  '1990-06-02', 'FEMALE', array[1]),
    ('Wiremu', 'Tane',  '1988-11-19', 'MALE',   array[3]),
    ('Mei',   'Chen',   '2001-01-27', 'FEMALE', array[2, 4]),
    ('Jonah', 'Faleolo','1997-08-05', 'MALE',   array[1, 4])
  ) as t(fn, ln, dob, gnd, classes) loop
    insert into persons (org_id, first_name, last_name, email, phone, dob, gender, person_type, person_types, custom_fields)
      values (v_club, r.fn, r.ln, lower(r.fn) || '.' || lower(r.ln) || '@harbourside.demo', '021 555 222',
              r.dob::date, r.gnd, 'player', array['player'], '{}'::jsonb)
      returning id into v_pid;
    foreach v_i in array r.classes loop
      insert into member_group_memberships (group_id, person_id, term_id) values (v_all[v_i], v_pid, v_t3);
    end loop;
  end loop;

  -- Coach takes every class.
  for v_i in 1..array_length(v_all, 1) loop
    insert into member_group_memberships (group_id, person_id, role, roles, term_id)
      values (v_all[v_i], v_coach, 'Coach', array['coach'], v_t3);
  end loop;

  -- ── Logins: make the club reachable from the org switcher ──
  for r in select id from auth.users where email in ('karl@getfrello.com', 'superadmin@friendlymanager.com') loop
    insert into org_members (user_id, org_id) values (r.id, v_club);
  end loop;
end $$;
