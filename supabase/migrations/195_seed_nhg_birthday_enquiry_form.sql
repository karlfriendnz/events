-- A Birthday Party Enquiry form for North Harbour Gymnastics, in the shape
-- <FormRenderer> consumes (config.groups / groupProfiles / groupFields). Public
-- page: /r/enquiry/<anything>?form_id=<id>. Idempotent on name.

do $$
declare
  v_org  uuid;
  v_form uuid;
  v_fields jsonb;
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;
  if exists (select 1 from registration_forms where org_id = v_org and name = 'Birthday Party Enquiry') then return; end if;

  -- Build the field list (answers are keyed by label; First/Last/Email/Phone map to the enquirer).
  v_fields := (
    select jsonb_agg(jsonb_build_object(
      'id', gen_random_uuid()::text, 'target', 'enquirer',
      'label', x.label, 'field_type', x.ftype, 'is_required', x.req,
      'placeholder', x.ph, 'options', x.opts
    ) order by x.sort)
    from (values
      (0,  'First Name',                       'text',        true,  'Parent / guardian first name', '[]'::jsonb),
      (1,  'Last Name',                        'text',        true,  'Parent / guardian last name',  '[]'::jsonb),
      (2,  'Email',                            'email',       true,  'you@example.com',              '[]'::jsonb),
      (3,  'Phone',                            'tel',         true,  '021 555 0000',                 '[]'::jsonb),
      (4,  'Birthday child''s name',           'text',        true,  '',                             '[]'::jsonb),
      (5,  'Age they are turning',             'number',      true,  '',                             '[]'::jsonb),
      (6,  'Preferred party date',            'date',        true,  '',                             '[]'::jsonb),
      (7,  'Preferred start time',            'select',      false, '',                             '["Morning (10:00am)","Midday (12:00pm)","Afternoon (2:00pm)","Late afternoon (4:00pm)"]'::jsonb),
      (8,  'Preferred venue',                 'select',      true,  '',                             '["HBC (Hibiscus Coast)","Albany","Eventfinda Stadium","No preference"]'::jsonb),
      (9,  'Party package',                   'select',      true,  '',                             '["Up to 15 children — $345","Up to 20 children — $395","Not sure yet"]'::jsonb),
      (10, 'Estimated number of children',    'number',      false, '',                             '[]'::jsonb),
      (11, 'Add-ons you''re interested in',   'multiselect', false, '',                             '["Celebration cake","Themed party bags","Pizza & juice","Extra 30 min party room","NHG medals","Decorations & balloons","Party photographer"]'::jsonb),
      (12, 'Dietary requirements / allergies','textarea',    false, 'Let us know about any allergies', '[]'::jsonb),
      (13, 'How did you hear about us?',      'select',      false, '',                             '["Google search","Facebook / Instagram","Friend or word of mouth","We attend classes here","Other"]'::jsonb),
      (14, 'Anything else we should know?',   'textarea',    false, '',                             '[]'::jsonb)
    ) as x(sort, label, ftype, req, ph, opts)
  );

  insert into registration_forms (org_id, name, config) values (
    v_org, 'Birthday Party Enquiry',
    jsonb_build_object(
      'groups', jsonb_build_array(jsonb_build_object('id', 'enquiry', 'audience', 'public', 'name', 'Birthday Party Enquiry')),
      'designs', jsonb_build_object('enquiry', jsonb_build_object(
        'style', 'single',
        'formHeading', 'Birthday Party Enquiry',
        'description', 'custom',
        'customDescription', '<p>Planning a birthday at North Harbour Gymnastics? Tell us a few details below and our team will be in touch to confirm availability and lock in the date.</p>'
      )),
      'groupProfiles', jsonb_build_object('enquiry', jsonb_build_array(
        jsonb_build_object('key', 'enquirer', 'label', 'Your details', 'min', 1, 'max', 1, 'kind', 'person')
      )),
      'groupFields', jsonb_build_object('enquiry', v_fields),
      'payment', '{}'::jsonb,
      'terms', '[]'::jsonb
    )
  ) returning id into v_form;

  raise notice 'Birthday Party Enquiry form created: % — share at /r/enquiry/nhg?form_id=%', v_form, v_form;
end $$;
