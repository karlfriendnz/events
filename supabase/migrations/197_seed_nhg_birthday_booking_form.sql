-- Wire a CUSTOM booking form into the Birthday Parties booking flow. The booking
-- wizard reads form_fields rows (not the FormRenderer config jsonb), keyed off
-- activity_modes.form_id — which was unset, so the booker showed the default
-- contact form. Core labels (First Name / Last Name / Email Address / Phone
-- Number) map to contact fields; SINGLE_SELECT options are stored as a JSON
-- string (what <BookingFormFields> JSON.parse()s). Idempotent.

do $$
declare v_org uuid; v_form uuid; v_bday uuid;
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;
  select id into v_bday from activities where org_id = v_org and name = 'Birthday Parties';
  if v_bday is null then return; end if;
  if exists (select 1 from registration_forms where org_id = v_org and name = 'Birthday Party Booking') then return; end if;

  insert into registration_forms (org_id, name, config) values (v_org, 'Birthday Party Booking', '{}'::jsonb) returning id into v_form;

  insert into form_fields (form_id, field_type, label, placeholder, is_required, is_event_only, options, sort_order) values
    (v_form, 'SHORT_TEXT',    'First Name',                        'Parent / guardian first name', true,  false, '[]'::jsonb, 0),
    (v_form, 'SHORT_TEXT',    'Last Name',                         'Parent / guardian last name',  true,  false, '[]'::jsonb, 1),
    (v_form, 'SHORT_TEXT',    'Email Address',                     'you@example.com',              true,  false, '[]'::jsonb, 2),
    (v_form, 'SHORT_TEXT',    'Phone Number',                      '021 555 0000',                 true,  false, '[]'::jsonb, 3),
    (v_form, 'SHORT_TEXT',    'Birthday child''s name',            '',                             true,  false, '[]'::jsonb, 4),
    (v_form, 'NUMBER',        'Age they are turning',              '',                             true,  false, '[]'::jsonb, 5),
    (v_form, 'DATE',          'Preferred party date',              '',                             false, false, '[]'::jsonb, 6),
    (v_form, 'SINGLE_SELECT', 'Preferred start time',              '',                             false, false,
       to_jsonb('["Morning (10:00am)","Midday (12:00pm)","Afternoon (2:00pm)","Late afternoon (4:00pm)"]'::text), 7),
    (v_form, 'LONG_TEXT',     'Dietary requirements / allergies',  'Any allergies we should know about', false, false, '[]'::jsonb, 8),
    (v_form, 'LONG_TEXT',     'Anything else we should know?',     '',                             false, false, '[]'::jsonb, 9);

  update activity_modes set form_id = v_form where activity_id = v_bday;

  raise notice 'Birthday Party Booking form % attached to Birthday Parties modes', v_form;
end $$;
