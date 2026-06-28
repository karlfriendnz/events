-- North Harbour Gymnastics demo polish: the ~100 bulk gymnasts (migration 192)
-- were created with no membership type, no Gymnastics level and no Medical notes,
-- so the /people directory was a sea of dashes. Backfill realistic values so the
-- demo looks real. Deterministic (hash of email) so it's stable + idempotent.
-- Gymnastics level is keyed by AGE; existing explicit levels (Mia/Olivia/Ella from
-- migration 189) are preserved.

do $$
declare
  v_org   uuid;
  v_level uuid;
  v_med   uuid;
  meds text[] := array[
    'Asthma — inhaler kept in gym bag',
    'Mild peanut allergy — no nuts on site',
    'Wears glasses for training',
    'Recovering from a wrist sprain (cleared to train)',
    'Eczema — no special care needed',
    'Hay fever in spring',
    'Lactose intolerant',
    'Hypermobile joints — coach aware',
    'Carries an EpiPen (bee sting)',
    'Occasional ankle support strapping'
  ];
begin
  select id into v_org from organisations where slug = 'north-harbour-gymnastics';
  if v_org is null then return; end if;

  select id into v_level from field_definitions where org_id = v_org and label = 'Gymnastics level';
  select id into v_med   from field_definitions where org_id = v_org and label = 'Medical notes';
  if v_level is null then return; end if;

  update persons p set
    -- Membership plan (mostly Term; a spread of Annual / Casual / Competitive)
    membership_type = case
      when date_part('year', age(p.dob)) >= 13 then 'Competitive'
      when abs(hashtext(p.email)) % 10 < 2     then 'Annual'
      when abs(hashtext(p.email)) % 10 = 2     then 'Casual'
      else 'Term'
    end,
    custom_fields =
      -- preserve an already-set Gymnastics level; otherwise assign by age band
      (case
        when coalesce(p.custom_fields, '{}'::jsonb) ? v_level::text
          then coalesce(p.custom_fields, '{}'::jsonb)
        else coalesce(p.custom_fields, '{}'::jsonb) || jsonb_build_object(
          v_level::text,
          to_jsonb(
            case
              when date_part('year', age(p.dob)) <= 4 then 'Kindy'
              when date_part('year', age(p.dob)) <= 6 then
                (array['Kindy','Recreational'])[1 + abs(hashtext(p.email)) % 2]
              when date_part('year', age(p.dob)) <= 8 then
                (array['Recreational','Tumbling'])[1 + abs(hashtext(p.email)) % 2]
              when date_part('year', age(p.dob)) <= 10 then
                (array['Tumbling','Trampoline','Parkour'])[1 + abs(hashtext(p.email)) % 3]
              when date_part('year', age(p.dob)) <= 12 then
                (array['Trampoline','Parkour','Performance'])[1 + abs(hashtext(p.email)) % 3]
              else 'Performance'
            end
          )
        )
      end)
      -- Medical notes on ~20% of gymnasts (only if the field exists + not already set)
      || (case
            when v_med is not null
             and abs(hashtext(p.email)) % 5 = 0
             and not (coalesce(p.custom_fields, '{}'::jsonb) ? v_med::text)
              then jsonb_build_object(v_med::text, to_jsonb(meds[1 + abs(hashtext(p.email)) % array_length(meds, 1)]))
            else '{}'::jsonb
          end)
  where p.org_id = v_org
    and 'gymnast' = any(p.person_types);

  -- Coaches / managers / admins read as staff on an annual membership
  update persons set membership_type = 'Staff'
   where org_id = v_org
     and ('coach' = any(person_types) or 'manager' = any(person_types) or 'admin' = any(person_types))
     and membership_type is null;
end $$;
