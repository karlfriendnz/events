-- Seed a demo gymnastics club — North Harbour Gymnastics (nhgym.co.nz) — with a
-- realistic baseline for the /proto/* model: gymnastics person & entity types,
-- demo people, and a few class/squad/birthday-party records with rosters.
-- Idempotent on slug. Super-admins open it via the org switcher / /admin.

do $$
declare
  v_org   uuid;
  v_level uuid;
  v_cls_tue uuid; v_cls_kindy uuid; v_squad uuid; v_party uuid;
begin
  if exists (select 1 from organisations where slug = 'north-harbour-gymnastics') then
    return;
  end if;

  insert into organisations (name, type, org_level, slug, currency, locale)
  values ('North Harbour Gymnastics', 'CLUB', 'CLUB', 'north-harbour-gymnastics', 'NZD', 'en-NZ')
  returning id into v_org;

  -- ── Person & entity types ──
  insert into person_target_types (org_id, key, label, kind, is_access, min_count, max_count, sort_order, member_slots) values
    (v_org, 'gymnast',           'Gymnast',           'person', false, 0, null, 0, '[]'::jsonb),
    (v_org, 'parent',            'Parent',            'person', false, 0, null, 1, '[]'::jsonb),
    (v_org, 'emergency_contact', 'Emergency contact', 'person', false, 0, null, 2, '[]'::jsonb),
    (v_org, 'coach',             'Coach',             'person', true,  0, null, 3, '[]'::jsonb),
    (v_org, 'manager',           'Manager',           'person', true,  0, null, 4, '[]'::jsonb),
    (v_org, 'admin',             'Admin',             'person', true,  0, null, 5, '[]'::jsonb),
    (v_org, 'class',  'Class',  'entity', false, 0, null, 6,
      '[{"person_type":"gymnast","label":"Gymnasts","min":1,"max":20,"role":"Gymnast"},{"person_type":"coach","label":"Coaches","min":1,"max":3,"role":"Coach"}]'::jsonb),
    (v_org, 'squad',  'Squad',  'entity', false, 0, null, 7,
      '[{"person_type":"gymnast","label":"Gymnasts","min":1,"max":16,"role":"Gymnast"},{"person_type":"coach","label":"Head coach","min":1,"max":2,"role":"Head coach"}]'::jsonb),
    (v_org, 'birthday_party', 'Birthday party', 'entity', false, 0, null, 8,
      '[{"person_type":"gymnast","label":"Birthday child","min":1,"max":1,"role":"Birthday child"},{"person_type":"coach","label":"Coaches","min":2,"max":2,"role":"Coach"}]'::jsonb);

  -- ── Custom fields ──
  insert into field_definitions (org_id, label, field_type, options, is_required, targets, target, rules, sort_order)
  values (v_org, 'Gymnastics level', 'select',
    '["Kindy","Recreational","Tumbling","Trampoline","Parkour","Performance"]'::jsonb,
    false, array['gymnast'], 'gymnast', '[]'::jsonb, 0)
  returning id into v_level;
  insert into field_definitions (org_id, label, field_type, options, is_required, targets, target, rules, sort_order) values
    (v_org, 'Medical notes', 'textarea', '[]'::jsonb, false, array['gymnast'], 'gymnast', '[]'::jsonb, 1),
    (v_org, 'Day & time',    'text',     '[]'::jsonb, false, array['class','squad'], 'class', '[]'::jsonb, 2),
    (v_org, 'Venue',         'select',   '["HBC","Albany","Eventfinda Stadium"]'::jsonb, false, array['class','squad','birthday_party'], 'class', '[]'::jsonb, 3);

  -- ── People ──
  insert into persons (org_id, first_name, last_name, email, phone, dob, gender, person_type, person_types) values
    (v_org, 'Sarah', 'Wright',  'sarah.wright@nhg.demo',  '021 555 0101', '1992-04-18', 'FEMALE', 'coach',   array['coach']),
    (v_org, 'Tom',   'Nguyen',  'tom.nguyen@nhg.demo',    '021 555 0102', '1995-08-09', 'MALE',   'coach',   array['coach']),
    (v_org, 'Lisa',  'Brown',   'lisa.brown@nhg.demo',    '021 555 0103', '1985-01-22', 'FEMALE', 'manager', array['manager','admin']),
    (v_org, 'John',  'Smith',   'john.smith@nhg.demo',    '021 555 0201', '1986-06-03', 'MALE',   'parent',  array['parent']),
    (v_org, 'Wei',   'Chen',    'wei.chen@nhg.demo',      '021 555 0202', '1984-12-11', 'FEMALE', 'parent',  array['parent']),
    (v_org, 'Priya', 'Patel',   'priya.patel@nhg.demo',   '021 555 0203', '1988-03-27', 'FEMALE', 'parent',  array['parent']),
    (v_org, 'Mia',   'Smith',   'mia.smith@nhg.demo',     null, '2016-03-12', 'FEMALE', 'gymnast', array['gymnast']),
    (v_org, 'Olivia','Chen',    'olivia.chen@nhg.demo',   null, '2014-07-01', 'FEMALE', 'gymnast', array['gymnast']),
    (v_org, 'Jack',  'Patel',   'jack.patel@nhg.demo',    null, '2018-02-20', 'MALE',   'gymnast', array['gymnast']),
    (v_org, 'Ruby',  'Wilson',  'ruby.wilson@nhg.demo',   null, '2015-09-05', 'FEMALE', 'gymnast', array['gymnast']),
    (v_org, 'Liam',  'Taylor',  'liam.taylor@nhg.demo',   null, '2013-11-30', 'MALE',   'gymnast', array['gymnast']),
    (v_org, 'Ella',  'Brown',   'ella.brown@nhg.demo',    null, '2019-06-15', 'FEMALE', 'gymnast', array['gymnast']);

  -- a few gymnastics levels
  update persons set custom_fields = jsonb_build_object(v_level::text, to_jsonb('Recreational'::text)) where org_id = v_org and email = 'mia.smith@nhg.demo';
  update persons set custom_fields = jsonb_build_object(v_level::text, to_jsonb('Performance'::text))  where org_id = v_org and email = 'olivia.chen@nhg.demo';
  update persons set custom_fields = jsonb_build_object(v_level::text, to_jsonb('Kindy'::text))        where org_id = v_org and email = 'ella.brown@nhg.demo';

  -- ── Entity records ──
  insert into entities (org_id, type_key, name) values (v_org, 'class', 'Tuesday Recreational') returning id into v_cls_tue;
  insert into entities (org_id, type_key, name) values (v_org, 'class', 'Kindy Gym (Sat AM)')   returning id into v_cls_kindy;
  insert into entities (org_id, type_key, name) values (v_org, 'squad', 'Performance Squad')     returning id into v_squad;
  insert into entities (org_id, type_key, name) values (v_org, 'birthday_party', 'Mia''s 9th Birthday') returning id into v_party;

  -- ── Rosters (entity_members) ──
  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_cls_tue, p.id, array['Gymnast'] from persons p
   where p.org_id = v_org and p.email in ('mia.smith@nhg.demo','ruby.wilson@nhg.demo','liam.taylor@nhg.demo');
  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_cls_tue, p.id, array['Coach'] from persons p where p.org_id = v_org and p.email = 'sarah.wright@nhg.demo';

  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_cls_kindy, p.id, array['Gymnast'] from persons p
   where p.org_id = v_org and p.email in ('ella.brown@nhg.demo','jack.patel@nhg.demo');
  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_cls_kindy, p.id, array['Coach'] from persons p where p.org_id = v_org and p.email = 'tom.nguyen@nhg.demo';

  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_squad, p.id, array['Gymnast'] from persons p
   where p.org_id = v_org and p.email in ('olivia.chen@nhg.demo','liam.taylor@nhg.demo');
  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_squad, p.id, array['Head coach'] from persons p where p.org_id = v_org and p.email = 'sarah.wright@nhg.demo';

  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_party, p.id, array['Birthday child'] from persons p where p.org_id = v_org and p.email = 'mia.smith@nhg.demo';
  insert into entity_members (org_id, entity_id, person_id, roles)
  select v_org, v_party, p.id, array['Coach'] from persons p
   where p.org_id = v_org and p.email in ('sarah.wright@nhg.demo','tom.nguyen@nhg.demo');
end $$;
