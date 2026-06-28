-- Seed booking add-ons for North Harbour Gymnastics, mirroring the demo-seed
-- style. Add-ons live on activity_modes.addons (jsonb) in the shape the booker
-- + <ModeAddonsEditor> expect: { id, name, description, type, qty_available,
-- fees:[{id,name,xero_code,amount}] }. Idempotent (skips if already seeded).

do $$
declare
  v_org uuid; v_bday uuid; v_hol uuid;
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;
  select id into v_bday from activities where org_id = v_org and name = 'Birthday Parties';
  select id into v_hol  from activities where org_id = v_org and name = 'Holiday Programme';
  if v_bday is null then return; end if;
  -- already seeded?
  if exists (select 1 from activity_modes where activity_id = v_bday and jsonb_typeof(addons) = 'array' and jsonb_array_length(addons) > 0) then return; end if;

  -- Birthday party add-ons (apply to both "Up to 15" and "Up to 20" modes)
  update activity_modes set addons = (
    select jsonb_agg(jsonb_build_object(
      'id', gen_random_uuid()::text, 'name', x.name, 'description', x.descr, 'type', x.atype, 'qty_available', null,
      'fees', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'name', x.name, 'xero_code', '', 'amount', x.amount))
    ))
    from (values
      ('Celebration cake',            'A themed cake for the birthday star',            'fee_base',       55),
      ('Themed party bags',           'A goodie bag for each guest to take home',       'fee_per_person',  7),
      ('Pizza & juice',               'Lunch catering for all the kids',                'fee_per_person',  9),
      ('Extra 30 min party room',     'More time to celebrate after the gym session',   'fee_base',       45),
      ('Additional party coach',      'An extra coach to help run a bigger group',      'fee_base',       40),
      ('NHG medal for every guest',   'A keepsake medal for each child',                'fee_per_person',  6),
      ('Decorations & balloons',      'Themed decorations set up before you arrive',    'fee_base',       35),
      ('Party photographer (30 min)', 'Action shots of the party, digital gallery',     'fee_base',       65)
    ) as x(name, descr, atype, amount)
  )
  where activity_id = v_bday;

  -- Holiday programme add-ons
  if v_hol is not null then
    update activity_modes set addons = (
      select jsonb_agg(jsonb_build_object(
        'id', gen_random_uuid()::text, 'name', x.name, 'description', x.descr, 'type', x.atype, 'qty_available', null,
        'fees', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'name', x.name, 'xero_code', '', 'amount', x.amount))
      ))
      from (values
        ('Catered lunch',  'Hot lunch provided each day',           'fee_per_person', 10),
        ('Late pickup',    'Supervised care until 5pm',             'fee_base',       20),
        ('NHG t-shirt',    'A take-home programme t-shirt',         'fee_per_person', 25)
      ) as x(name, descr, atype, amount)
    )
    where activity_id = v_hol;
  end if;
end $$;
